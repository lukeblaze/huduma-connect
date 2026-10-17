# Huduma Connect

A responsive mini eCitizen-style public service request system with a Vercel serverless API and Supabase database.

## Run locally

Install Vercel CLI if needed, then run the project locally:

```bash
npx vercel dev
```

For the database, create a Supabase project, open its SQL editor, and run [`supabase-schema.sql`](./supabase-schema.sql).

## Features

- Responsive public service landing page
- Request submission form with required-field validation
- Reference number generation
- Recent-request tracking from the Supabase database
- Vercel serverless API at `/api/requests`
- Accessible labels, navigation, and status messaging
- No frontend build step or third-party runtime dependencies

## Vercel environment variables

Add these variables in Vercel Project Settings → Environment Variables:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service-role key (never expose this in frontend code)
- `SUPABASE_ANON_KEY` — your Supabase anon/public key (safe for browser authentication)

Run the updated [`supabase-schema.sql`](./supabase-schema.sql) again after pulling this version. It adds user ownership and Row Level Security policies. In Supabase Authentication → Providers, enable Email. For the fastest demo, you may disable email confirmation; otherwise users must confirm their email before signing in.

## GitHub and Vercel deployment

```bash
git init
git add .
git commit -m "Add public service request system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Import the GitHub repository into Vercel, add the two environment variables, and deploy. Every future push to `main` will trigger a new deployment.
