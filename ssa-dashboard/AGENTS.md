# AGENTS.md — SSA Object Classification (Next.js UI + FastAPI)

## Project goal
Build a Space Situational Awareness (SSA) system that classifies orbiting objects using TLE data.
Minimum classes: payload, rocket_body, debris. Optional: unknown for low-confidence.

## Current phase
PHASE 1 (UI shell): Next.js dashboard with a simple TLE input + mocked prediction output.
Later phases: connect to FastAPI /predict, add explainability and history.

## Tech stack
- Frontend: Next.js (App Router), TypeScript, Tailwind
- Backend (later): FastAPI + ML model
- Contracts:
  - UI will call POST /predict with { line1, line2, threshold }
  - Response will be { predicted_class, confidence, region, proba, features?, explanation? }

## Setup commands
- Install deps: `npm install`
- Run dev: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Tests (if present): `npm test`

## Repo structure
- `src/app/` pages and UI
- `src/lib/` shared utilities (validation, API client)
- `src/types/` shared types (PredictionResponse, etc.)

## Coding rules
- Keep UI minimal, functional, and readable.
- No new libraries without strong reason.
- Use TypeScript types for API responses.
- Validate TLE format (two lines, starts with "1 " and "2 ") before calling backend.
- Never commit secrets. Keep `.env*` ignored.

## Work style for agents
- Prefer small, reviewable commits.
- When changing behavior, update: UI + types + any docs.
- Add basic error handling and loading states.
