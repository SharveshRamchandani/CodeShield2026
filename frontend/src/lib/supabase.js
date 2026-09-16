import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Initial 32 problem statements catalog for fallback/instant rendering
export const FALLBACK_PROBLEM_STATEMENTS = [
  { code: "CS 01", title: "PhishGuard", description: "Build a tool that takes a URL, message, or website and flags it as Safe, Suspicious, or Dangerous, with reasons behind the call, not just a label.", domain: "Cybersecurity" },
  { code: "CS 02", title: "ScamShield", description: "Build a scam message classifier for SMS/chat that catches patterns like fake rewards, urgent payment demands, and bogus job offers.", domain: "Cybersecurity" },
  { code: "CS 03", title: "Password Guardian", description: "Build a password strength checker that scores a password and suggests concrete improvements. Bonus: a generator that estimates resistance to common cracking methods.", domain: "Cybersecurity" },
  { code: "CS 04", title: "QR Safe", description: "Build an app that scans a QR code, reveals where it actually leads, and gives a quick safety verdict before the user opens it.", domain: "Cybersecurity" },
  { code: "CS 05", title: "CyberSafe Student", description: "Build an interactive quiz that asks students about their online habits and returns a personalized cybersecurity safety score.", domain: "Cybersecurity" },
  { code: "CS 06", title: "Secure Login", description: "Build a login system with real security baked in: password validation, failed attempt detection, account lockout, and OTP verification.", domain: "Cybersecurity" },
  { code: "CS 07", title: "PrivacyCheck", description: "Build a tool that scans text or documents before sharing and flags personal info the user is about to overshare, phone numbers, emails, addresses, and more.", domain: "Cybersecurity" },
  { code: "CS 08", title: "Cyber Incident Reporter", description: "Build a platform where students report phishing, scams, or suspicious links, with automatic categorization and a live incident dashboard.", domain: "Cybersecurity" },
  { code: "CS 09", title: "Cyber Awareness Challenge", description: "Build a scenario based game where players make security decisions around passwords, phishing, social media, and scams, and earn points for playing it safe. Realistic email and message scenarios should teach players to spot the fakes.", domain: "Cybersecurity" },
  { code: "CS 10", title: "EmailGuard", description: "Build a system that scans a pasted email and calls out red flags such as urgency, unknown senders, sketchy links, and requests for personal info, with a clear explanation of why.", domain: "Cybersecurity" },
  { code: "CS 11", title: "USB Safety", description: "Build a tool that scans a removable drive and flags risky file types or suspicious filenames before the user opens anything.", domain: "Cybersecurity" },
  { code: "CS 12", title: "Digital Footprint Checker", description: "Build an educational tool that shows students how much they expose online across their activity, with a footprint score and tips to shrink it.", domain: "Cybersecurity" },
  { code: "CS 13", title: "Cyber Hygiene Assistant", description: "Build a checklist driven app that audits a user's overall security habits such as passwords, updates, privacy settings, and account protection, and turns it into a simple risk score with personalized recommendations.", domain: "Cybersecurity" },
  { code: "CS 14", title: "Secure Wi Fi Guide", description: "Build an interactive guide that teaches users how to spot and safely use public or home Wi Fi networks.", domain: "Cybersecurity" },
  { code: "CS 15", title: "OTP Safety Simulator", description: "Build a simulation that walks users through secure OTP flows and the common mistakes that get people scammed.", domain: "Cybersecurity" },
  { code: "CS 16", title: "Simple Encrypt", description: "Build a beginner friendly text encryption and decryption tool. Bonus: visualize the encryption process step by step.", domain: "Cybersecurity" },
  { code: "CS 17", title: "Cyber HelpDesk", description: "Build a helpdesk where users describe a cyber incident in plain language, such as \"I clicked a suspicious link\" or \"someone asked for my OTP,\" and get an immediate risk level plus practical next steps.", domain: "Cybersecurity" },
  { code: "CS 18", title: "AI Cyber Guardian", description: "Build a single AI assistant that helps students with passwords, phishing, scams, and privacy all in one place, a security co pilot rather than a single purpose checker.", domain: "Cybersecurity" },
  { code: "IT 01", title: "AI Study Companion", description: "Build an AI tool that takes a student's study material and generates study plans, condensed notes, quiz questions, and flashcards for revision.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 02", title: "Smart Campus Assistant", description: "Build a chatbot that answers questions about departments, facilities, timings, and rules, and helps students navigate classrooms, labs, and campus events.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 03", title: "AI Resume Assistant", description: "Build a tool that reviews a student's resume and suggests improvements to structure, content, and skills presentation.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 04", title: "Career Compass", description: "Build an app that recommends career paths based on a student's interests, skills, and field of study.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 05", title: "Skill Gap Finder", description: "Build a tool that compares a student's current skills against what a chosen career or job role actually requires.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 06", title: "Smart Feedback and Complaint Analyzer", description: "Build a system that reads student feedback or complaints and automatically categorizes them into areas like academics, hostel, transport, food, infrastructure, and admin, while surfacing recurring issues.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 07", title: "Smart Attendance Assistant", description: "Build an app that tracks attendance percentage and tells students exactly what they need to do to stay eligible for exams.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 08", title: "AI Language Assistant", description: "Build a multilingual tool that helps students translate or understand educational content across languages.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 09", title: "AI Grammar Assistant", description: "Build a tool that catches common grammar mistakes in student writing and suggests fixes.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 10", title: "Smart Expense Manager", description: "Build an expense tracker that categorizes student spending and surfaces useful insights.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 11", title: "AI Book Recommendation System", description: "Build a recommender that suggests books based on a student's interests and reading history.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 12", title: "AI Food Recommendation", description: "Build a system that recommends food based on budget, cuisine, dietary needs, and availability.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 13", title: "Smart Task Planner", description: "Build a task manager that prioritizes work by deadline, importance, and estimated effort, and reminds students of upcoming items.", domain: "Innovation & Emerging Technologies" },
  { code: "IT 14", title: "Smart Lost and Found", description: "Build a campus lost and found platform that uses basic image or text matching to surface likely matches.", domain: "Innovation & Emerging Technologies" },
];
