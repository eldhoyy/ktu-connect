# KTU Connect

A student-focused resource hub for APJ Abdul Kalam Technological University (KTU).

## What's included

- KTU study notes and downloadable learning resources
- Previous-year question papers and search tools
- Syllabus pages and semester resources
- Exam timetables and academic updates
- Student community links, polls, and notices
- Academic utilities and PDF tools

## Local preview

This repository is a static-first website. Open `index.html` through a local web server to preview the static pages. Server-backed admin and community features require Vercel Functions and the environment variables listed below.

## Server-backed features

- **Notices:** Public notices are served from `notices-store.json`. The authorised administrator signs in with GitHub and changes are committed to the repository's `main` branch.
- **Admin access:** GitHub OAuth, an encrypted six-hour HttpOnly session cookie, server-side account allowlisting, and same-origin checks protect admin operations.
- **Community doubts:** Public submissions are stored in Upstash Redis, rate-limited per IP, and remain private until an administrator approves them. Approved answers are then visible publicly.

No OAuth secrets, session secrets, or Redis credentials belong in frontend files or in Git.

## Vercel configuration (required before enabling admin/community features)

Import this repository into Vercel with the repository root as the project root. Keep the static output at the root; Vercel automatically serves the `api/` serverless functions.

Add these environment variables in **Vercel → Project → Settings → Environment Variables**:

| Variable | Purpose |
|---|---|
| `APP_ORIGIN` | Exact production origin, e.g. `https://ktuconnectone.vercel.app` (no trailing slash) |
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_ADMIN_LOGIN` | Exact GitHub username authorised to administer the site |
| `GITHUB_ADMIN_ID` | Optional numeric GitHub user ID for an additional identity check |
| `KTU_SESSION_SECRET` | Random secret of at least 32 characters |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

Create a GitHub OAuth App with the callback URL:

`https://YOUR-PRODUCTION-DOMAIN/api/auth/callback`

The OAuth app needs the `public_repo` scope so the administrator can update this public repository's notice data. Use a dedicated GitHub account only if it is the account that owns/administers this repository; set `GITHUB_ADMIN_LOGIN` to the authorised account. Do not share the client secret or session secret in chat.

Create an Upstash Redis database and copy its REST URL and token directly into Vercel's environment-variable settings. Do not put them in `config.js`.

After adding or changing environment variables, redeploy the Vercel project for the changes to take effect. Until these services are configured, the static resource pages and bundled notices remain available, while admin login and community submission will show a configuration/unavailable message.

## Existing integrations

The timetable automation, PYQ resources, existing pages, assets, and academic datasets are retained. Their separate hosting/service migrations are not part of this admin migration.

## Project identity

The public website identity is **KTU Connect**. Existing academic resources and page design are retained.
