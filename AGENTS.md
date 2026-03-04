# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 16 App Router project. UI routes and shared layout live in `src/app`, with server endpoints in `src/app/api/games/route.ts` and `src/app/api/analyze/route.ts`. Reusable client components live in `src/components`. Chess.com fetching, engine evaluation, OpenAI prompts, and shared types live in `src/lib`. Static files belong in `public/`.

## Build, Test, and Development Commands
- `npm run dev`: start the local dev server on `http://localhost:3000`.
- `npm run build`: create the production build.
- `npm run start`: serve the production build locally.
- `npm run lint`: run ESLint across the repo.

Install dependencies with `npm install`. Set `OPENAI_API_KEY` in `.env.local` before testing the analysis flow.

## Coding Style & Naming Conventions
Use TypeScript with strict typing and the `@/*` alias for imports under `src/`. Match the existing formatting: 2-space indentation, double quotes, and semicolons. Keep React components in PascalCase, hooks and helpers in camelCase, and filenames in kebab-case such as `progress-summary.tsx` and `llm-coach.ts`. Prefer small focused modules and place shared interfaces in `src/lib/types.ts`.

Linting is handled by ESLint via `eslint.config.mjs` with `eslint-config-next` and TypeScript rules. Run `npm run lint` before opening a PR.

## Testing Guidelines
There is no automated test suite in the repository yet. For now, every change should pass `npm run lint` and be manually verified in `npm run dev`. When adding tests, place them near the feature they cover with names like `analyzer.test.ts` or `results-view.test.tsx`, and prioritize pure logic in `src/lib` plus API route behavior.

## Commit & Pull Request Guidelines
Git history is minimal, so keep commit messages short, imperative, and specific, following the existing style of concise subjects. Good examples: `Add streaming progress states` or `Handle Chess.com user not found`.

Pull requests should explain the user-facing change, note any env or API dependencies, and include screenshots or short recordings for UI updates. Link the related issue when available and list the manual checks you ran.

## Security & Configuration Tips
Do not commit `.env.local` or API keys. This app depends on Chess.com, `chess-api.com`, and OpenAI responses, so handle rate limits and failures defensively when touching API or analysis code.
