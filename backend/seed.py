import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

problem_statements = [
    ("CS 01", "PhishGuard", "Build a tool that takes a URL, message, or website and flags it as Safe, Suspicious, or Dangerous, with reasons behind the call, not just a label.", "Cybersecurity"),
    ("CS 02", "ScamShield", "Build a scam message classifier for SMS/chat that catches patterns like fake rewards, urgent payment demands, and bogus job offers.", "Cybersecurity"),
    ("CS 03", "Password Guardian", "Build a password strength checker that scores a password and suggests concrete improvements. Bonus: a generator that estimates resistance to common cracking methods.", "Cybersecurity"),
    ("CS 04", "QR Safe", "Build an app that scans a QR code, reveals where it actually leads, and gives a quick safety verdict before the user opens it.", "Cybersecurity"),
    ("CS 05", "CyberSafe Student", "Build an interactive quiz that asks students about their online habits and returns a personalized cybersecurity safety score.", "Cybersecurity"),
    ("CS 06", "Secure Login", "Build a login system with real security baked in: password validation, failed attempt detection, account lockout, and OTP verification.", "Cybersecurity"),
    ("CS 07", "PrivacyCheck", "Build a tool that scans text or documents before sharing and flags personal info the user is about to overshare, phone numbers, emails, addresses, and more.", "Cybersecurity"),
    ("CS 08", "Cyber Incident Reporter", "Build a platform where students report phishing, scams, or suspicious links, with automatic categorization and a live incident dashboard.", "Cybersecurity"),
    ("CS 09", "Cyber Awareness Challenge", "Build a scenario based game where players make security decisions around passwords, phishing, social media, and scams, and earn points for playing it safe. Realistic email and message scenarios should teach players to spot the fakes.", "Cybersecurity"),
    ("CS 10", "EmailGuard", "Build a system that scans a pasted email and calls out red flags such as urgency, unknown senders, sketchy links, and requests for personal info, with a clear explanation of why.", "Cybersecurity"),
    ("CS 11", "USB Safety", "Build a tool that scans a removable drive and flags risky file types or suspicious filenames before the user opens anything.", "Cybersecurity"),
    ("CS 12", "Digital Footprint Checker", "Build an educational tool that shows students how much they expose online across their activity, with a footprint score and tips to shrink it.", "Cybersecurity"),
    ("CS 13", "Cyber Hygiene Assistant", "Build a checklist driven app that audits a user's overall security habits such as passwords, updates, privacy settings, and account protection, and turns it into a simple risk score with personalized recommendations.", "Cybersecurity"),
    ("CS 14", "Secure Wi Fi Guide", "Build an interactive guide that teaches users how to spot and safely use public or home Wi Fi networks.", "Cybersecurity"),
    ("CS 15", "OTP Safety Simulator", "Build a simulation that walks users through secure OTP flows and the common mistakes that get people scammed.", "Cybersecurity"),
    ("CS 16", "Simple Encrypt", "Build a beginner friendly text encryption and decryption tool. Bonus: visualize the encryption process step by step.", "Cybersecurity"),
    ("CS 17", "Cyber HelpDesk", "Build a helpdesk where users describe a cyber incident in plain language, such as \"I clicked a suspicious link\" or \"someone asked for my OTP,\" and get an immediate risk level plus practical next steps.", "Cybersecurity"),
    ("CS 18", "AI Cyber Guardian", "Build a single AI assistant that helps students with passwords, phishing, scams, and privacy all in one place, a security co pilot rather than a single purpose checker.", "Cybersecurity"),
    ("IT 01", "AI Study Companion", "Build an AI tool that takes a student's study material and generates study plans, condensed notes, quiz questions, and flashcards for revision.", "Innovation & Emerging Technologies"),
    ("IT 02", "Smart Campus Assistant", "Build a chatbot that answers questions about departments, facilities, timings, and rules, and helps students navigate classrooms, labs, and campus events.", "Innovation & Emerging Technologies"),
    ("IT 03", "AI Resume Assistant", "Build a tool that reviews a student's resume and suggests improvements to structure, content, and skills presentation.", "Innovation & Emerging Technologies"),
    ("IT 04", "Career Compass", "Build an app that recommends career paths based on a student's interests, skills, and field of study.", "Innovation & Emerging Technologies"),
    ("IT 05", "Skill Gap Finder", "Build a tool that compares a student's current skills against what a chosen career or job role actually requires.", "Innovation & Emerging Technologies"),
    ("IT 06", "Smart Feedback and Complaint Analyzer", "Build a system that reads student feedback or complaints and automatically categorizes them into areas like academics, hostel, transport, food, infrastructure, and admin, while surfacing recurring issues.", "Innovation & Emerging Technologies"),
    ("IT 07", "Smart Attendance Assistant", "Build an app that tracks attendance percentage and tells students exactly what they need to do to stay eligible for exams.", "Innovation & Emerging Technologies"),
    ("IT 08", "AI Language Assistant", "Build a multilingual tool that helps students translate or understand educational content across languages.", "Innovation & Emerging Technologies"),
    ("IT 09", "AI Grammar Assistant", "Build a tool that catches common grammar mistakes in student writing and suggests fixes.", "Innovation & Emerging Technologies"),
    ("IT 10", "Smart Expense Manager", "Build an expense tracker that categorizes student spending and surfaces useful insights.", "Innovation & Emerging Technologies"),
    ("IT 11", "AI Book Recommendation System", "Build a recommender that suggests books based on a student's interests and reading history.", "Innovation & Emerging Technologies"),
    ("IT 12", "AI Food Recommendation", "Build a system that recommends food based on budget, cuisine, dietary needs, and availability.", "Innovation & Emerging Technologies"),
    ("IT 13", "Smart Task Planner", "Build a task manager that prioritizes work by deadline, importance, and estimated effort, and reminds students of upcoming items.", "Innovation & Emerging Technologies"),
    ("IT 14", "Smart Lost and Found", "Build a campus lost and found platform that uses basic image or text matching to surface likely matches.", "Innovation & Emerging Technologies"),
]

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

cur.executemany(
    "insert into problem_statements (code, title, description, domain) values (%s, %s, %s, %s)",
    problem_statements
)

conn.commit()
print(f"Inserted {cur.rowcount if cur.rowcount != -1 else len(problem_statements)} rows.")

cur.close()
conn.close()