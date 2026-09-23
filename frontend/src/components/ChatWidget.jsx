import { useState, useRef, useEffect } from "react";
import { apiClient } from "../api/client";

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Hi! I'm the CodeShield 2026 Assistant for Cyber Club, BIT Sathy. Ask me about problem statements, team registration, domains, or hackathon rules.",
};

const QUICK_PROMPTS = [
  "Recommend a problem statement",
  "Show hackathon domains",
  "What are the team rules?",
];

function formatAssistantText(text) {
  if (!text) return "";
  // Strip any raw markdown bold asterisks or underscores
  const cleaned = text.replace(/\*\*/g, "").replace(/__/g, "").replace(/^#{1,4}\s*/gm, "").trim();
  const lines = cleaned.split("\n");

  return lines.map((line, lIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={lIdx} className="h-1.5" />;
    }

    const isBullet = /^[-*•]\s+/.test(trimmed);
    const isNumbered = /^\d+\.\s+/.test(trimmed);
    const numMatch = trimmed.match(/^(\d+)\.\s+/);

    // Parse PS tags like [CS-01] or [IT-12]
    const contentText = isBullet
      ? trimmed.replace(/^[-*•]\s+/, "")
      : isNumbered
      ? trimmed.replace(/^\d+\.\s+/, "")
      : trimmed;

    const parts = contentText.split(/(\[(?:CS|IT)-\d{2}\])/g);

    return (
      <div
        key={lIdx}
        className={`leading-relaxed ${
          isBullet || isNumbered ? "flex items-start gap-1.5 pl-1 my-0.5" : "my-0.5"
        }`}
      >
        {isBullet && (
          <span className="text-cyan text-[10px] font-bold select-none mt-0.5">&bull;</span>
        )}
        {isNumbered && numMatch && (
          <span className="text-cyan text-[10px] font-bold select-none mt-0.5">{numMatch[1]}.</span>
        )}
        <span className="flex-1">
          {parts.map((part, pIdx) => {
            if (/^\[(?:CS|IT)-\d{2}\]$/.test(part)) {
              return (
                <span
                  key={pIdx}
                  className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-cyan/15 text-cyan border border-cyan/30 font-bold font-mono text-[10.5px]"
                >
                  {part}
                </span>
              );
            }
            return part;
          })}
        </span>
      </div>
    );
  });
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend !== null ? textToSend : inputValue).trim();
    if (!text || loading) return;

    const userMessage = { role: "user", content: text };
    const newHistory = [...messages, userMessage];

    setMessages(newHistory);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    try {
      // Prepare history payload for API (exclude initial greeting if it's the only one)
      const historyPayload = newHistory.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiClient.post("/api/chat", {
        message: text,
        history: historyPayload,
      });

      const reply = res?.reply || "I didn't receive a response. Please reach out to cyberclub@bitsathy.ac.in.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err?.message ||
            "Unable to reach the assistant service right now. Please email cyberclub@bitsathy.ac.in.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-mono">
      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[380px] h-[520px] max-h-[82vh] bg-panel border border-cyan/40 shadow-2xl flex flex-col mb-3 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-base border-b border-hairline flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div>
                <div className="text-xs font-bold text-content tracking-wide">
                  // CODESHIELD AI BOT
                </div>
                <div className="text-[10px] text-muted">Cyber Club · BIT Sathy</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearChat}
                title="Reset conversation"
                className="text-[11px] text-muted hover:text-cyan transition-colors px-1 py-0.5"
              >
                ⟲ Reset
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-lg leading-none text-muted hover:text-content px-1.5 py-0.5 hover:bg-base border border-transparent hover:border-hairline transition-colors"
                title="Close chat"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <span className="text-[9px] text-subtle mb-1 uppercase font-bold tracking-wider">
                    {isUser ? "> YOU" : "[AI ASSISTANT]"}
                  </span>
                  <div
                    className={`p-3 max-w-[88%] text-xs leading-relaxed break-words ${
                      isUser
                        ? "bg-cyan text-zinc-950 font-medium whitespace-pre-wrap"
                        : "bg-base text-content border border-hairline"
                    }`}
                  >
                    {isUser ? msg.content : formatAssistantText(msg.content)}
                  </div>
                </div>
              );
            })}

            {/* Loading / Generating Indicator */}
            {loading && (
              <div className="flex flex-col items-start">
                <span className="text-[9px] text-subtle mb-1 uppercase font-bold tracking-wider">
                  [AI ASSISTANT]
                </span>
                <div className="p-3 bg-base border border-cyan/40 text-cyan text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-bounce" />
                  <span className="text-[11px] text-muted ml-1">Searching knowledge base...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          {messages.length <= 2 && !loading && (
            <div className="px-3 pb-2 pt-1 border-t border-hairline/40 bg-panel flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2 py-1 text-[10px] text-subtle hover:text-cyan bg-base border border-hairline hover:border-cyan/50 transition-colors text-left truncate max-w-full"
                >
                  &rarr; {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div className="p-2.5 bg-base border-t border-hairline">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask about problem statements or rules..."
                className="flex-1 px-3 py-2 text-xs bg-panel text-content border border-hairline focus:border-cyan focus:outline-none disabled:opacity-50 font-mono resize-none overflow-y-auto max-h-24 leading-relaxed break-words block"
              />
              <button
                type="button"
                disabled={loading || !inputValue.trim()}
                onClick={() => handleSendMessage()}
                className="px-3.5 py-2 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono flex items-center gap-1 shrink-0 h-[34px]"
                title="Send Message"
              >
                <span>Send</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Open/Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-panel border border-cyan/60 hover:border-cyan shadow-xl text-content hover:text-cyan transition-all hover:scale-105 active:scale-95"
        title="Open CodeShield 2026 AI Assistant"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-bold font-mono tracking-wider uppercase text-cyan">
          {isOpen ? "[✕ CLOSE ASSISTANT]" : "[💬 AI ASSISTANT]"}
        </span>
      </button>
    </div>
  );
}
