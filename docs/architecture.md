# Najoom Platform Architecture

## Overview
Najoom Platform is an Arabic RTL educational platform for science students in grades 5 and 6 at Arwa Bint Abdul Muttalib Basic School.

The system follows a Modular Monolith architecture.

## Technology Stack
- Next.js
- React
- TypeScript (strict)
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Zod
- Vitest
- Playwright
- Gemini API through a server-side abstraction layer

## Main Modules
- Authentication and Authorization
- Students and Sections
- Curriculum
- Question Bank
- Assessments
- Assignments
- Student Dashboard
- Points and Achievements
- Leaderboard
- Notifications
- Teacher Dashboard
- Learning Analytics
- Remedial Plans
- Adaptive Flashcards
- Educational Resources
- Administration
- AI Services

## Security Principles
- Server-side authorization
- Passwords are never stored in plaintext
- Secrets never exposed to the browser
- Environment secrets are never committed to Git
- Input validation using Zod
- Principle of least privilege
- Internal audit logs for sensitive operations
- Student private analytics are not exposed to other students
- AI has no direct database access

## AI Architecture
Application
→ AI Service
→ Data Sanitizer
→ Prompt Builder
→ Gemini Provider Adapter
→ Output Validator
→ Application

AI features must fail gracefully and must never prevent core educational features from working.

## Data Architecture
PostgreSQL is the primary database.

Prisma will manage the database schema and migrations.

Historical academic records must be preserved when a student changes section.

## Deployment
Deployment decisions will be made only after verifying current free-tier limits, security requirements, and database compatibility.

No production secrets will be stored in the repository.
