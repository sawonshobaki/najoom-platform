# Najoom Platform — Architecture & Product Decisions

This document records fixed decisions for Najoom Platform.
Agents and contributors must not change these decisions without explicit approval.

## Product Scope
- Platform name: Najoom Platform — منصة نجوم
- Slogan: بالعِلم نرتقي
- School: مدرسة أروى بنت عبد المطلب الأساسية
- Subject: Science only
- Grades: 5 and 6
- Primary language: Arabic
- Interface direction: RTL
- Approximately 250 female students
- One teacher in V1
- One administrator in V1

## Grade Sections
Grade 5:
- أ
- ب
- د

Grade 6:
- أ
- ب
- ج

## Architecture
Use a Modular Monolith.

Do not introduce microservices unless the project requirements materially change.

Primary stack:
- Next.js
- React
- TypeScript strict mode
- Tailwind CSS
- PostgreSQL
- Prisma
- Zod

Testing:
- Vitest for unit tests
- Playwright for end-to-end tests

## Authentication & Security
- No public student registration.
- Accounts are managed by authorized administration.
- Passwords must never be stored in plaintext.
- Authorization must be enforced server-side.
- Secrets must never be committed to Git.
- Secrets must never use NEXT_PUBLIC_* variables.
- Sensitive changes must have internal audit logs.
- Students cannot access another student's private academic analytics.
- Students cannot edit grades, scores, points, grade, or section.

## Assessments
- Objective assessments are graded deterministically.
- AI must not determine objective assessment scores.
- No exam retake in V1.
- Back navigation during an exam is disabled.
- Teacher controls when results become visible.

## Assignments
- Students submit text answers.
- No assignment file uploads in V1.
- AI must NOT grade assignments.
- Assignment grading and feedback are performed by the teacher.

## AI
Gemini must be accessed only through a server-side provider abstraction.

AI must not have direct database access.

Allowed AI use cases include:
- Question generation
- Assessment generation
- Learning analytics assistance
- Remedial plan generation
- Adaptive flashcards
- Educational resource suggestions

AI-generated educational content must be reviewable by the teacher where appropriate.

Core platform functionality must continue working if the AI service is unavailable.

## Leaderboard
Students may see the complete ranking of students within their own section.

Leaderboard may show:
- Student name
- Rank
- Points
- Level/title
- Appropriate public achievements

Leaderboard must not expose:
- Detailed grades
- Weaknesses
- Errors
- Remedial plans
- Private learning analytics

Rank is calculated from current points and is not stored as permanent truth.

## Privacy
Collect only information necessary for educational operation.

Do not collect unnecessary:
- Home addresses
- Location data
- Health information
- Family information
- Student profile photographs

Student information must not be used for advertising or marketing.

## Out of Scope for V1
Do not add:
- Parent portal
- Multiple schools
- Multiple subjects
- Additional teachers
- Student chatbot
- Social messaging
- Payments
- Marketplace
- Video meetings
- Native Android or iOS applications
- Assignment file uploads
- AI assignment grading

## Change Control
Any change to these decisions must be explicitly approved before implementation.

Agents must not silently expand the scope of the project.

## Visual Identity — Phase 1

The visual foundation for Najoom Platform is approved for V1.

Fixed visual decisions:

- Arabic-first RTL interface.
- No dark mode in V1.
- Responsive design for mobile, tablet, desktop, and classroom displays.
- Najoom uses an original science-and-exploration visual identity.
- The approved Najoom mascot is the official character reference for V1.
- Jordanian identity may appear through carefully selected visual elements.
- Primary visual direction uses navy, blue, teal, sky, and gold.
- Animation should remain purposeful and moderate.
- Learning interactions should use subtle animation.
- Achievement moments may use more expressive animation.
- No sound effects in V1.
- Avoid generic AI-generated dashboard aesthetics.
- Avoid excessive gradients, decorative clutter, and unnecessary emoji.
- Accessibility, readable contrast, keyboard focus, and touch-friendly controls are required.

The approved primary visual reference is stored at:

`public/brand/najoom-brand-main.png`

The full poster image is a visual reference and welcome-page asset. It must not be reused as the logo throughout the entire application.

Future brand assets should derive from the approved identity and may include:

- Compact Najoom logo/mark.
- Standalone Najoom mascot.
- Header-compatible brand asset.
- Achievement and learning-state mascot variants.

These derived assets must preserve the approved character and visual identity rather than redesigning the mascot from scratch.

Phase 1 visual foundation was verified with:

- ESLint
- TypeScript type checking
- Vitest
- Next.js production build
- Desktop visual inspection
- Mobile responsive inspection at 390 × 844
