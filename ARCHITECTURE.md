# Architecture

This document explains how ERP Students (Grade Tracker) is built and why. It is written from the code in this repository (`src/lib/calc`, `src/features`, `supabase/`).

## Map

Everything the app contains, by area.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Inter, Segoe UI, Arial, sans-serif','fontSize':'16px','lineColor':'#94a3b8','cScale0':'#4f46e5','cScaleLabel0':'#ffffff','cScale1':'#0891b2','cScaleLabel1':'#ffffff','cScale2':'#059669','cScaleLabel2':'#ffffff','cScale3':'#d97706','cScaleLabel3':'#ffffff','cScale4':'#db2777','cScaleLabel4':'#ffffff','cScale5':'#7c3aed','cScaleLabel5':'#ffffff','cScale6':'#2563eb','cScaleLabel6':'#ffffff','cScale7':'#0d9488','cScaleLabel7':'#ffffff','cScale8':'#ea580c','cScaleLabel8':'#ffffff','cScale9':'#9333ea','cScaleLabel9':'#ffffff','cScale10':'#16a34a','cScaleLabel10':'#ffffff','cScale11':'#e11d48','cScaleLabel11':'#ffffff'}}}%%
mindmap
  root((Grade Tracker))
    Auth
      Email sign in
      Google sign in
      Password reset
    Dashboard
      Overall GPA
      Filter by term
      Course grades
    Terms
      Group courses by term
    Courses
      Course name and credits
      Categories
      Assessments
      Course detail
    Board
      Planned
      Pending
      Completed
      Drag and drop
    Simulator
      Target grade
      Score needed on remaining assessments
      Play it your way
    AI syllabus import
      PDF or DOCX
      Text read in the browser
      Edge Function
      Forced tool call
      Output validation
      Warnings
      Review and import
    Calculation core
      Grade scale and bands
      Category mode
      Points mode
      GPA with retakes
    Settings
      Theme
      Language English Portuguese Hindi
      Grade replacement
    Admin
      Account list
    Onboarding
      Excel workbook to SQL script
    Security
      RLS per user
      Role change blocked
      Profile created on sign up
    Quality
      27 unit tests
    Platform
      React TypeScript Vite
      TanStack Query and Zod
      Tailwind
      Supabase
    Next steps
      Test the Edge Function end to end
      UI and RLS tests
      Roles for universities
```

## Flow from start to end

The main path through the app, with its branches. Blue is a step, yellow a decision, green a good end state, orange a state that needs attention, red a blocked or flagged case.

```mermaid
%%{init: {'theme':'base','flowchart':{'curve':'basis','nodeSpacing':35,'rankSpacing':45,'padding':12},'themeVariables':{'fontFamily':'Inter, Segoe UI, Arial, sans-serif','fontSize':'15px','lineColor':'#64748b','edgeLabelBackground':'#ffffff','clusterBkg':'#f8fafc','clusterBorder':'#94a3b8','titleColor':'#334155'}}}%%
flowchart TD
  A("Register or sign in") --> B("Dashboard with overall GPA")
  B --> T("Create a term")
  T --> C("Create a course with credits")
  C --> G{How is the grading defined}
  G -->|By hand| CAT("Categories with weights or points")
  G -->|Syllabus file| UP("Upload PDF or DOCX")
  G -->|Excel workbook| ONB("Onboarding script builds SQL")
  UP --> RD("Text read in the browser")
  RD --> EF("Edge Function keeps the API key server side")
  EF --> AI("Anthropic API with a forced tool call")
  AI --> VAL{Output valid}
  VAL -->|No| ERR("Error returned and nothing imported")
  VAL -->|Yes| WARN("Warnings for ambiguous rules")
  WARN --> REV("Student reviews and edits")
  REV --> CAT
  ONB --> CAT
  CAT --> AS("Add assessments")
  AS --> BD("Board with Planned, Pending and Completed")
  BD --> SC("Enter scores")
  SC --> CG("Course grade from the grade scale band")
  CG --> RET{Course was retaken}
  RET -->|Yes| LAST("Only the last attempt counts")
  RET -->|No| GPA
  LAST --> GPA("Credit weighted GPA on the 4.0 scale")
  GPA --> B
  BD --> SIM("Simulator")
  SIM --> TG("Choose a target grade")
  TG --> NEED("Score needed on the remaining assessments")
  SIM --> PLAY("Play it your way with hypothetical scores")
  NEED --> OK{Result}
  OK -->|Already guaranteed| GUA("Target already reached")
  OK -->|Achievable| ACH("Percent needed on the rest")
  OK -->|Impossible| IMP("Highest grade still reachable")
classDef start fill:#4f46e5,stroke:#312e81,color:#ffffff,stroke-width:2px
classDef dec fill:#fef3c7,stroke:#d97706,color:#78350f,stroke-width:2px
classDef act fill:#e0e7ff,stroke:#6366f1,color:#1e1b4b,stroke-width:1.5px
classDef good fill:#d1fae5,stroke:#059669,color:#064e3b,stroke-width:2px
classDef bad fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px
classDef amb fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px
class A start
class G,OK,RET,VAL dec
class ERR,IMP bad
class GUA good
class ACH,AI,AS,B,BD,C,CAT,CG,EF,GPA,LAST,NEED,ONB,PLAY,RD,REV,SC,SIM,T,TG,UP,WARN act
```

## 1. What the system does

A mobile and tablet friendly web app for university students. A student tracks grades per course, simulates the score needed on upcoming assessments to reach a target grade, and sees a GPA on the US 0 to 4.0 scale. It replaces the Excel templates students use today.

## 2. Big picture

```
 Browser (React SPA)
   |-- reads syllabus files locally ........ pdf.js (PDF), mammoth (DOCX)
   |-- GPA, grading modes, simulator ....... pure functions in src/lib/calc
   |  supabase-js (user JWT)
   v
 Supabase
   |-- Auth ............... users and profiles
   |-- Postgres ........... tables with Row Level Security (data per user)
   '-- Edge Function ...... extract-syllabus -> Anthropic Messages API
```

## 3. Calculation core (`src/lib/calc`)

All grade logic is in pure TypeScript functions with no UI and no network, so it is easy to test.

- **Grade scale (`gradeScale.ts`):** maps a percentage to a band with letter and GPA points, with a default US scale. Students can have their own scale (`grade_scales`, `grade_scale_bands`).
- **Two grading modes:** category mode (weighted categories, `categoryMode.ts`) and points mode (`pointsMode.ts`).
- **GPA (`gpa.ts`):** credit-weighted across courses and terms. When a course is retaken, the retake chain collapses to the most recent attempt (option `onlyLastAttempt`), then the average is taken.
- **Simulator (`simulator.ts`):** given the remaining assessments, computes the score needed to reach a target grade band, and supports "play it your way" with hypothetical scores.

27 unit tests (Vitest) cover the scale, both modes, the GPA and the simulator.

## 4. Data model and security

Tables: `profiles`, `grade_scales`, `grade_scale_bands`, `terms`, `courses`, `categories`, `assessments`. All have Row Level Security, and the typical policy is "all operations only on your own rows" (`auth.uid()`).

- A trigger (`profiles_lock_role`, function `prevent_role_change`) stops users changing their own role.
- A trigger (`on_auth_user_created`) creates the profile when a user signs up.
- `admin_account_list()` is a database function for the admin area.

The schema is a single migration (`0001_init.sql`).

## 5. AI syllabus import (`supabase/functions/extract-syllabus`)

A student uploads a syllabus (PDF or DOCX). The flow:

1. **In the browser**, the file is turned into plain text (`extractText.ts`). Nothing is sent over the network at this step.
2. The text is sent to the **Edge Function**, which keeps the API key server side as a secret (`ANTHROPIC_API_KEY`).
3. The function calls the **Anthropic Messages API** with a system prompt that defines the extraction rules (expand per-item point breakdowns, do not guess weights or dates, put gating rules into warnings) and a **forced tool call** (`record_grading_structure`) with a JSON schema. This makes the model return structured data and not free text.
4. The function **validates the model output** (types, finite numbers, non-empty names) before trusting it, and handles errors separately: invalid request (400), missing configuration (500), network failure (500), API error (502), refusal and unreadable response.
5. Input is limited to 200,000 characters to protect context size and cost.
6. In the UI the student **reviews and edits** the extracted structure before importing it ("Review, tweak, import").

Design choices worth noting: structured output through tool use, validation of everything the model returns, ambiguous rules surfaced as warnings and not invented, and a human review step before data is saved.

## 6. Frontend

React, TypeScript and Vite with feature folders (`courses`, `terms`, `assessments`, `simulator`, `syllabus-import`, `dashboard`, `board`, `admin`, `auth`, `settings`). TanStack Query for data, Zod for validation, react-router for navigation, Tailwind CSS 4, and react-i18next for English, Portuguese and Hindi. The board view uses dnd-kit for drag and drop between Planned, Pending and Completed.

## 7. Onboarding script

`supabase/seed/onboard-student.mjs` builds onboarding SQL from a student's existing Excel workbook, so a student can move from a spreadsheet without retyping everything.

## 8. How it was built

Developed with agentic AI coding (Claude Code), with the calculation core covered by tests.

## 9. Known limitations and next steps

- The Edge Function has not been exercised end to end against the live API in this repository, because it needs the `ANTHROPIC_API_KEY` secret to be provisioned (as noted in the function header). The code is complete, and the model identifier is a constant that should be checked against the current Anthropic documentation.
- CORS on the Edge Function is open (`*`). Supabase's JWT verification should stay enabled so only signed-in users can call it.
- There are no automated tests for the UI or for Row Level Security yet.
- The product is planned to be offered to universities and professors, which would need multi-tenant roles beyond the current per-user model.
