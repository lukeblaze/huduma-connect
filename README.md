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
- `ADMIN_EMAIL` — the exact email address of the administrator account

Run the updated [`supabase-schema.sql`](./supabase-schema.sql) again after pulling this version. It adds user ownership and Row Level Security policies. In Supabase Authentication → Providers, enable Email. For the fastest demo, you may disable email confirmation; otherwise users must confirm their email before signing in.

The admin dashboard is shown automatically when the signed-in email matches `ADMIN_EMAIL`. The admin can review every request, open uploaded images, change status, and see live totals.

The optional image upload accepts up to five PNG, JPEG, or WebP images. They are stored in the public Supabase Storage bucket named `request-images` created by the SQL script. For production use, change the bucket to private and issue signed URLs.

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
