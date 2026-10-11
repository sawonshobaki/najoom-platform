<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Najoom Platform Project Rules

## Project
Najoom is an Arabic RTL educational platform focused on Jordanian science education.

Main stack:
- Next.js 16
- React 19
- TypeScript strict
- Tailwind CSS
- PostgreSQL
- Prisma
- Vitest

## Working style
- Work incrementally.
- Do not make unrelated changes.
- Do not refactor working code unless required by the task.
- Preserve existing behavior unless the task explicitly changes it.
- Before editing, inspect the current implementation and relevant tests.
- Never reconstruct a file from an older snapshot when the current repository version exists.

## Phase discipline
- Work on one phase or feature at a time.
- Do not expand scope with optional features unless explicitly requested.
- The product owner currently prioritizes speed and a smaller V1.
- Existing completed features should remain unless explicitly requested to remove them.

## Security
- Never hardcode passwords, API keys, database credentials, session secrets, or other secrets.
- Never commit .env values.
- All authorization must be enforced server-side.
- Every admin API must verify admin authorization.
- Never trust client-side validation alone.
- Passwords must never be returned from APIs.
- Do not expose sensitive internal errors to users.

## Database and Prisma
- Inspect prisma/schema.prisma before making relation or deletion assumptions.
- Respect onDelete behavior and referential integrity.
- Schema changes require explicit justification.
- Do not modify production data or create destructive migrations without explicit approval.
- Prefer atomic operations for concurrent state changes where appropriate.

## Student management
- Do not add extra student-management features unless explicitly requested.
- Existing features may remain.
- The current priority is simple administration and moving forward to later phases.
- Do not implement direct section transfer unless explicitly requested.
- Do not reintroduce removed requirements based only on old documentation.

## UI
- Arabic and RTL first.
- Responsive on mobile and desktop.
- Preserve the Najoom visual identity and existing CSS variables.
- Avoid unnecessary redesigns.
- Do not replace functional UI with generic templates.
- User-facing errors and labels should be Arabic.

## Code quality
- TypeScript strict.
- Avoid any unless clearly justified.
- Keep business logic out of React components when practical.
- Put sensitive domain/database logic in server/service modules.
- Keep functions and names clear.
- Follow existing project conventions.

## Verification
Before declaring a coding task complete, run:

npx tsc --noEmit
npm test
npm run lint
npm run build

Report:
- which files changed
- what behavior changed
- test/typecheck/lint/build results
- any remaining warning or risk

Do not claim success if any required check fails.

## Git
- Do not commit secrets.
- Do not commit temporary password-reset scripts unless explicitly requested.
- Do not push or merge unless explicitly asked.
- Keep commits focused and clearly named.

## Important current direction
The project owner wants to avoid unnecessary feature expansion.
Prefer finishing the requested core functionality and moving to the next phase.
When there is a choice between adding more admin controls and progressing to curriculum, prefer progressing to curriculum unless explicitly told otherwise.
