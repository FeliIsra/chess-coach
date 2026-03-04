## Environment

Set these variables before running the app:

```bash
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
HISTORY_VIEWER_SALT=...
```

## Supabase

Hosted persistence is defined under `supabase/`.

```bash
npx supabase db push
```

This applies the migration that creates the `analysis_sessions` table used by `/api/history`.

History visibility is isolated by a hashed viewer key derived from the incoming IP address.
Set `HISTORY_VIEWER_SALT` in production to avoid predictable hashes.

## Product Feedback Agents

Reusable product-focused agent prompts are available under `agents/product/`.

- `agents/product/product-strategist.md`
- `agents/product/ux-research-analyst.md`
- `agents/product/growth-retention-pm.md`
- `agents/product/ux-copy-content-designer.md`
- `agents/product/roadmap-prioritization-pm.md`

Use `agents/product/README.md` as the starting point and run them as a panel when making roadmap or UX decisions.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
