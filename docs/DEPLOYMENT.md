# TOP ENGLISH PROGRAM — DEPLOYMENT GUIDE

This document provides complete instructions for deploying the **TOP ENGLISH PROGRAM** platform to production hosting environments (**Netlify** and **Vercel**) connected to the Supabase Cloud backend.

---

## 1. ARCHITECTURE OVERVIEW

The application uses a serverless static-first architecture:
- **Frontend**: Static HTML5 + Vanilla CSS3 + Modular ES6 JavaScript.
- **Hosting**: Netlify or Vercel (serves directly from root `.`, zero compilation needed).
- **Backend**: Supabase PostgreSQL + Storage + Auth + Edge Functions.
- **Client SDK**: `@supabase/supabase-js@2` loaded via ESM CDN (`esm.sh`).
- **Repository**: [tutortampan/Top-English-Class](https://github.com/tutortampan/Top-English-Class) (branch: `master`).

---

## 2. DEPLOYMENT OPTION A: NETLIFY (RECOMMENDED)

`netlify.toml` is configured in the repository root.

### Steps:
1. Log in to [Netlify Dashboard](https://app.netlify.com/).
2. Click **"Add new site"** → **"Import an existing project"**.
3. Choose **GitHub** as the Git provider and authorize access.
4. Select the repository: `tutortampan/Top-English-Class`.
5. Configuration settings:
   - **Branch to deploy**: `master`
   - **Base directory**: *(leave empty)*
   - **Build command**: *(leave empty)*
   - **Publish directory**: `.`
6. Click **"Deploy site"**.
7. Netlify will build and deploy the site in ~10 seconds, providing an `https://<site-name>.netlify.app` production URL.

### Custom Domain (Optional):
- Under **Site configuration** → **Domain management**, click **"Add a domain"**.
- Add your domain (e.g. `assessment.topenglish.id`) and point CNAME to Netlify.
- Automatic SSL/TLS certificate will be provisioned via Let's Encrypt.

---

## 3. DEPLOYMENT OPTION B: VERCEL

`vercel.json` is configured in the repository root.

### Steps:
1. Log in to [Vercel Dashboard](https://vercel.com/).
2. Click **"Add New..."** → **"Project"**.
3. Import `tutortampan/Top-English-Class` from your connected GitHub account.
4. Project Configuration:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: *(leave empty)*
   - **Output Directory**: *(leave empty / root)*
5. Click **"Deploy"**.
6. Deployment completes instantaneously with a production `https://<project-name>.vercel.app` URL.

---

## 4. SUPABASE BACKEND CONNECTIVITY

The frontend connects to the production Supabase cloud project:
- **Supabase URL**: `https://xuiszvwfjccvucqpactf.supabase.co`
- **Publishable Key**: `sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4`

Both credentials are baked into `js/supabase.js` with optional override via `window.__ENV__`.

### Database Health & Latency:
- You can monitor live database connectivity directly from the admin panel:
  Navigate to **DESK** → **Settings & Diagnostics** → **System Tools & Diagnostics** → click **"Measure Ping"**.

---

## 5. ROUTE MAP FOR ONLINE TESTING

| URL Path | Purpose | Key Functionality |
| :--- | :--- | :--- |
| `/` or `/index.html` | Student Login | Organization/Program/Batch/Student cascading selectors + PIN login |
| `/dashboard.html` | Student Portal | Subject cards, unlocked levels, available challenges, progress radar |
| `/exam.html` | Assessment Runner | Timer engine, STT speech-to-text, multiple choice, written tolerance |
| `/result.html` | Performance Summary | Scoring breakdown, Damerau-Levenshtein match reviews, grade badges |
| `/admin.html` | ABCD Admin Console | Academy, Blueprint, Challenges, Desk modules + DataGrid + Exports |

---

## 6. CONTINUOUS DEPLOYMENT (GIT PUSH)

Every time code is pushed to `origin master`, both Netlify and Vercel will automatically trigger a new deployment preview and update the production URL within seconds.
