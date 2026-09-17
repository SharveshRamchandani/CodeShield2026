"""
Updates the `description` column of problem_statements for all 32 codes.
Uses the same session-pooler connection pattern as seed.py.

Usage:
    export DATABASE_URL="postgresql://...session-pooler-connection-string..."
    python update_descriptions.py
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise SystemExit("Set DATABASE_URL env var (session pooler connection string)")

# code -> (title, description)
DESCRIPTIONS = {
    "CS 01": ("PhishGuard", "Build a tool that takes a URL, message, or website and flags it as Safe, Suspicious, or Dangerous, with reasons behind the call, not just a label."),
    "CS 02": ("ScamShield", "Build a scam message classifier for SMS/chat that catches patterns like fake rewards, urgent payment demands, and bogus job offers."),
    "CS 03": ("Password Guardian", "Build a password strength checker that scores a password and suggests concrete improvements. Bonus: a generator that estimates resistance to common cracking methods."),
    "CS 04": ("QR Safe", "Build an app that scans a QR code, reveals where it actually leads, and gives a quick safety verdict before the user opens it."),
    "CS 05": ("CyberSafe Student", "Build an interactive quiz that asks students about their online habits and returns a personalized cybersecurity safety score."),
    "CS 06": ("Secure Login", "Build a login system with real security baked in: password validation, failed attempt detection, account lockout, and OTP verification."),
    "CS 07": ("PrivacyCheck", "Build a tool that scans text or documents before sharing and flags personal info the user is about to overshare, phone numbers, emails, addresses, and more."),
    "CS 08": ("Cyber Incident Reporter", "Build a platform where students report phishing, scams, or suspicious links, with automatic categorization and a live incident dashboard."),
    "CS 09": ("Cyber Awareness Challenge", "Build a scenario based game where players make security decisions around passwords, phishing, social media, and scams, and earn points for playing it safe. Realistic email and message scenarios should teach players to spot the fakes."),
    "CS 10": ("EmailGuard", "Build a system that scans a pasted email and calls out red flags such as urgency, unknown senders, sketchy links, and requests for personal info, with a clear explanation of why."),
    "CS 11": ("USB Safety", "Build a tool that scans a removable drive and flags risky file types or suspicious filenames before the user opens anything."),
    "CS 12": ("Digital Footprint Checker", "Build an educational tool that shows students how much they expose online across their activity, with a footprint score and tips to shrink it."),
    "CS 13": ("Cyber Hygiene Assistant", "Build a checklist driven app that audits a user's overall security habits such as passwords, updates, privacy settings, and account protection, and turns it into a simple risk score with personalized recommendations."),
    "CS 14": ("Secure Wi Fi Guide", "Build an interactive guide that teaches users how to spot and safely use public or home Wi Fi networks."),
    "CS 15": ("OTP Safety Simulator", "Build a simulation that walks users through secure OTP flows and the common mistakes that get people scammed."),
    "CS 16": ("Simple Encrypt", "Build a beginner friendly text encryption and decryption tool. Bonus: visualize the encryption process step by step."),
    "CS 17": ("Cyber HelpDesk", "Build a helpdesk where users describe a cyber incident in plain language, such as \"I clicked a suspicious link\" or \"someone asked for my OTP,\" and get an immediate risk level plus practical next steps."),
    "CS 18": ("AI Cyber Guardian", "Build a single AI assistant that helps students with passwords, phishing, scams, and privacy all in one place, a security co pilot rather than a single purpose checker."),

    "IT 01": ("AI Study Companion", "Build an AI tool that takes a student's study material and generates study plans, condensed notes, quiz questions, and flashcards for revision."),
    "IT 02": ("Smart Campus Assistant", "Build a chatbot that answers questions about departments, facilities, timings, and rules, and helps students navigate classrooms, labs, and campus events."),
    "IT 03": ("AI Resume Assistant", "Build a tool that reviews a student's resume and suggests improvements to structure, content, and skills presentation."),
    "IT 04": ("Career Compass", "Build an app that recommends career paths based on a student's interests, skills, and field of study."),
    "IT 05": ("Skill Gap Finder", "Build a tool that compares a student's current skills against what a chosen career or job role actually requires."),
    "IT 06": ("Smart Feedback and Complaint Analyzer", "Build a system that reads student feedback or complaints and automatically categorizes them into areas like academics, hostel, transport, food, infrastructure, and admin, while surfacing recurring issues."),
    "IT 07": ("Smart Attendance Assistant", "Build an app that tracks attendance percentage and tells students exactly what they need to do to stay eligible for exams."),
    "IT 08": ("AI Language Assistant", "Build a multilingual tool that helps students translate or understand educational content across languages."),
    "IT 09": ("AI Grammar Assistant", "Build a tool that catches common grammar mistakes in student writing and suggests fixes."),
    "IT 10": ("Smart Expense Manager", "Build an expense tracker that categorizes student spending and surfaces useful insights."),
    "IT 11": ("AI Book Recommendation System", "Build a recommender that suggests books based on a student's interests and reading history."),
    "IT 12": ("AI Food Recommendation", "Build a system that recommends food based on budget, cuisine, dietary needs, and availability."),
    "IT 13": ("Smart Task Planner", "Build a task manager that prioritizes work by deadline, importance, and estimated effort, and reminds students of upcoming items."),
    "IT 14": ("Smart Lost and Found", "Build a campus lost and found platform that uses basic image or text matching to surface likely matches."),
}


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    updated = 0
    missing = []

    for code, (title, description) in DESCRIPTIONS.items():
        cur.execute(
            "UPDATE problem_statements SET description = %s WHERE code = %s",
            (description, code),
        )
        if cur.rowcount == 0:
            missing.append(code)
        else:
            updated += cur.rowcount

    conn.commit()

    print(f"Updated {updated} rows.")
    if missing:
        print(f"WARNING: no matching row found for codes: {missing}")
        print("Check that your 'code' column values match exactly (e.g. 'CS 01' vs 'CS01').")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()