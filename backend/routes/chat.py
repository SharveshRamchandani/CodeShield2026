import time
import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
import psycopg2
import httpx

from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Assistant Chat"])

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

# Fast, low-latency production models prioritized in order of generation speed
FAST_PREFERRED_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "allam-2-7b",
]

_async_client: Optional[httpx.AsyncClient] = None


def get_async_client() -> httpx.AsyncClient:
    global _async_client
    if _async_client is None or _async_client.is_closed:
        _async_client = httpx.AsyncClient(
            timeout=8.0,
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _async_client


# =========================================================================
# Request & Response Schemas
# =========================================================================

class ChatMessage(BaseModel):
    role: str  # "user", "assistant", or "system"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    reply: str


# =========================================================================
# Base System Prompt & Dynamic Context Builder (with 5-minute In-Memory Cache)
# =========================================================================

BASE_SYSTEM_PROMPT = """You are the CodeShield 2026 assistant, built for Cyber Club, Bannari Amman Institute of Technology (BIT Sathy).

CONTEXT YOU HAVE ACCESS TO (injected per request, not memorized):
- Full list of 32 problem statements (Cybersecurity CS-01 to CS-18, Innovation & Emerging Tech IT-01 to IT-14)
- Event schedule and rules
- Registration requirements

EVENT FACTS (fixed, don't hallucinate beyond these):
- 24-hour internal hackathon, hybrid format
- Final presentation happens at the end of the event
- Exclusively for BIT Sathy students
- Teams: 2-4 members, each needs name, roll/college ID, email
- Only two domains: Cybersecurity and Innovation & Emerging Technologies (there is no separate "CSIT" track — it was merged into Cybersecurity)
- Contact: cyberclub@bitsathy.ac.in

RULES & FORMATTING:
1. Answer only from the injected context (problem statements, schedule, rules) and the event facts above. If something isn't in there, say you don't have that info and point to cyberclub@bitsathy.ac.in — do not guess dates, rules, or PS details.
2. When asked to recommend a problem statement, ask 1-2 clarifying questions about their idea/skills if needed, then recommend max 2 PS codes with a one-line reason each.
3. Keep answers short — 2-4 sentences unless the user asks for a list (e.g. "show all cybersecurity PS").
4. No filler like "Great question!" or "I'd be happy to help." Answer directly.
5. If asked something unrelated to CodeShield (general coding help, other events), redirect: say this bot is scoped to CodeShield 2026 only.
6. Never fabricate a problem statement, deadline, or rule that isn't in your context.
7. CRITICAL FORMATTING: Do NOT use markdown asterisks (no **bold**, no *italic*). Write in clean, professional plain text with clean punctuation.
"""

def sanitize_ai_reply(text: str) -> str:
    """
    Cleans up any markdown asterisks, raw bold tags, or header hashes so replies look polished and native.
    """
    if not text:
        return text
    import re
    # Remove markdown bold/italic asterisks and underscores
    cleaned = text.replace("**", "").replace("__", "")
    # Remove leading markdown header tags (# Header)
    cleaned = re.sub(r'^[#]+\s*', '', cleaned, flags=re.MULTILINE)
    # Clean up multiple consecutive empty lines
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    return cleaned

_cached_context: Optional[str] = None
_cached_context_time: float = 0.0


def get_injected_context(db=None) -> str:
    """
    Fetches active problem statements and schedule/rules with a 5-minute in-memory cache to eliminate DB query latency.
    """
    global _cached_context, _cached_context_time
    now = time.time()
    if _cached_context and (now - _cached_context_time < 300):
        return _cached_context

    ps_lines = []
    if db is not None:
        try:
            with db.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT code, title, domain, description 
                    FROM problem_statements 
                    ORDER BY domain ASC, code ASC;
                    """
                )
                rows = cur.fetchall()
                for r in rows:
                    desc = (r.get("description") or "").strip().replace("\n", " ")
                    if len(desc) > 160:
                        desc = desc[:160] + "..."
                    ps_lines.append(f"- [{r.get('code')}] ({r.get('domain')}) {r.get('title')}: {desc}")
        except Exception as err:
            logger.warning(f"Failed to query problem statements for chat injection: {err}")

    ps_context = "\n".join(ps_lines) if ps_lines else "Problem Statements: 32 total across Cybersecurity (CS-01 to CS-18) and Innovation & Emerging Technologies (IT-01 to IT-14)."

    additional_context = f"""
=== INJECTED REAL-TIME PROBLEM STATEMENTS ===
{ps_context}

=== INJECTED RULES & WORKFLOW ===
- Attendance: Check-in required on Day 1 and Day 2.
- Submission deliverables: Project title, abstract, repository URL, and presentation deck/demo URL.
- Once submitted by team leader, deliverables are permanently locked for judge evaluation and can only be reopened by administrators.
- Confirmation: Registered teams receive auto-confirmation emails and submission receipt emails.
"""
    _cached_context = f"{BASE_SYSTEM_PROMPT}\n\n{additional_context}"
    _cached_context_time = now
    return _cached_context


# =========================================================================
# Chat Endpoint (Supports both / and no-slash to prevent 307 redirects)
# =========================================================================

@router.post("", response_model=ChatResponse, include_in_schema=False)
@router.post(
    "/",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with CodeShield 2026 AI Assistant",
)
async def chat_with_assistant(
    req: ChatRequest,
    db=Depends(get_db),
):
    """
    Answers questions about CodeShield 2026 problem statements, rules, schedule, and team registration.
    Uses Groq API with highest-speed model prioritization and in-memory context caching.
    """
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not groq_api_key:
        logger.warning("GROQ_API_KEY is not configured in backend environment.")
        return ChatResponse(
            reply="The CodeShield Assistant is currently waiting for API key configuration. Please reach out to cyberclub@bitsathy.ac.in for help with your query."
        )

    if not req.message.strip():
        return ChatResponse(reply="Please enter a question or message about CodeShield 2026.")

    system_prompt = get_injected_context(db)

    # Build messages list (System prompt + conversation history + current user message)
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt}
    ]

    # Include recent conversation turns (up to last 6 messages for context & low latency)
    if req.history:
        for item in req.history[-6:]:
            if item.role in ("user", "assistant"):
                messages.append({"role": item.role, "content": item.content})

    messages.append({"role": "user", "content": req.message.strip()})

    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json",
    }

    client = get_async_client()

    # Determine models order: custom GROQ_MODEL if set, otherwise FAST_PREFERRED_MODELS
    configured_model = os.getenv("GROQ_MODEL", "").strip()
    models_to_try = FAST_PREFERRED_MODELS.copy()
    if configured_model:
        models_to_try = [configured_model] + [m for m in models_to_try if m != configured_model]

    last_error = None
    for model_name in models_to_try:
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 180,
        }
        try:
            t0 = time.time()
            resp = await client.post(GROQ_ENDPOINT, json=payload, headers=headers)
            dt = time.time() - t0
            if resp.status_code == 200:
                data = resp.json()
                reply_text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if reply_text:
                    clean_reply = sanitize_ai_reply(reply_text)
                    logger.info(f"Groq chat responded using [{model_name}] in {dt:.3f}s")
                    return ChatResponse(reply=clean_reply)

            if resp.status_code in (400, 404):
                logger.warning(f"Groq model {model_name} failed with {resp.status_code}, falling back...")
                last_error = resp.text
                continue

            logger.error(f"Groq API error {resp.status_code} on model {model_name}: {resp.text}")
            last_error = resp.text
            break
        except httpx.RequestError as req_err:
            logger.warning(f"Request failed for model {model_name}: {req_err}")
            continue

    logger.error(f"All Groq models failed. Last error: {last_error}")
    return ChatResponse(
        reply="I'm having trouble connecting right now. Please try again or reach out to cyberclub@bitsathy.ac.in."
    )
