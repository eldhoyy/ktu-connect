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

This repository is a static-first website. Open `index.html` through a local web server to preview it. Some features depend on external services configured in the project.

## Deploying with Vercel

1. Import this GitHub repository into Vercel.
2. Keep the project root as the repository root.
3. For the static pages, use no build command and publish the repository root.
4. Configure the required external services before enabling server-backed features. Set `ALLOWED_ORIGINS` to the exact deployed KTU Connect origin and set `BRAND_TEXT` to `Downloaded from KTU Connect`. Set `BRAND_LOGO_PATH` only if you provide your own artwork. Firebase and Hugging Face integrations still need to be moved to accounts you control before production use.
5. Add your custom domain only when you are ready to configure it.

The site is not yet tied to a custom domain.

## Project identity

The public website identity is **KTU Connect**. The academic resource files and existing page functionality are retained.
