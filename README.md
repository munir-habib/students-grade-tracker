# ERP Students (Grade Tracker)

Mobile and tablet friendly web app that lets university students track grades per course, simulate the scores they need on upcoming assessments and see a GPA on the US 0 to 4.0 scale. It replaces the Excel templates students use today and is planned to be offered to universities and professors.

## Stack

React · TypeScript · Vite · Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions) · TanStack Query · react-i18next (English, Portuguese, Hindi) · Zod · dnd-kit · pdf.js and mammoth for document parsing

## Features

- **Courses, terms and assessments** with category-based and points-based grading modes.
- **Grade simulator:** what score do I need on the next exam to reach a target grade.
- **GPA calculation** with configurable grade scale, covered by unit tests.
- **Syllabus import:** upload a PDF or DOCX syllabus and an Edge Function sends the text to the Anthropic API to extract the grading structure (categories and planned assessments). Requires an `ANTHROPIC_API_KEY` secret on the Supabase project.
- **Board view** with drag and drop.
- **Per-user data isolation** with Row Level Security; admin area.
- Light and dark themes.

## Project layout

```
src/features     courses, terms, assessments, simulator, syllabus-import, dashboard, board, admin
src/lib/calc     GPA, grade scales, simulator (with tests)
supabase/        migration, onboarding script, extract-syllabus Edge Function
```

## Project map

🟦 app (frontend) · 🟩 database and backend · 🟧 tests and scripts · 🟪 AI workflow · ⬜ config and assets

| | Folder | What is in it |
|---|---|---|
| 🟦 | `src/features/` | Courses, terms, assessments, simulator, syllabus import, dashboard, board, admin |
| 🟦 | `src/app/`, `src/locales/` | App shell and translations (EN, PT, HI) |
| 🟦 | `src/lib/calc/` | GPA, grade scales and simulator, with unit tests |
| 🟩 | `supabase/migrations/` | Schema and Row Level Security |
| 🟩 | `supabase/functions/extract-syllabus/` | Edge Function that calls the Anthropic API |
| 🟧 | `supabase/seed/` | Script that builds onboarding SQL from a student's Excel workbook |
| ⬜ | `public/` and root files | Assets, Vite, TypeScript, ESLint and Vercel configuration |

<!-- Demo: add your screenshots to docs/screenshots/ and uncomment.
## Demo
![Home](docs/screenshots/home.png)
[Watch the video](https://youtu.be/...)
-->

## Run locally

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run dev
```

## License

Copyright (c) 2026 Munir Habib. All rights reserved. The source code is public for portfolio review only; see [LICENSE](LICENSE).
