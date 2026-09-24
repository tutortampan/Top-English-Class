# TOP ENGLISH CLASS

Online English assessment and testing platform built with Static HTML/CSS/JS and Supabase backend.

## Quick Start

1. **Supabase Setup**
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Run `supabase-setup.sql` in your Supabase SQL Editor
   - Copy `.env.example` to `.env` and fill in your credentials
   - Update `js/supabase.js` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **Deploy Edge Functions**
   ```bash
   supabase functions deploy student-login
   supabase functions deploy start-exam
   supabase functions deploy submit-exam
   ```

3. **Run Locally**
   Open `index.html` in any modern browser (Chrome/Edge recommended for Speech Recognition).
   Or serve with a local static file server:
   ```bash
   npx serve .
   ```

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Student login (4-step: Program → Class → Name → PIN) |
| `dashboard.html` | Student dashboard with subject/level progression |
| `exam.html` | Exam taking interface (all 4 answer types) |
| `result.html` | Exam result with breakdown |
| `admin.html` | Admin console (DATABASE / CLASS / STUDENT / EXAM tabs) |

## Architecture

- **Frontend**: Modular HTML5 + Vanilla CSS + ES Modules JavaScript
- **Backend**: Supabase PostgreSQL + RLS + Edge Functions
- **Auth**: PIN-based student login (hashed), Supabase Auth for admin
- **Scoring**: Server-authoritative (submit-exam Edge Function)
- **Timer**: Server-authoritative (`expected_end_at` from server)

## Business Rules

See `AGENTS.md` for comprehensive rules and `docs/` for specifications and decisions.

## Grades

| Score | Grade |
|-------|-------|
| 100%  | S     |
| 91–99% | A   |
| 71–90% | B   |
| 51–70% | C   |
| 31–50% | D   |
| 11–30% | E   |
| 0–10%  | F   |
