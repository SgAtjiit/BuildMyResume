# BuildMyResume

<p align="left">
   <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=000000" alt="React 18" />
   <img src="https://img.shields.io/badge/TypeScript-0052CC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
   <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
   <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
   <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=000000" alt="Firebase" />
   <img src="https://img.shields.io/badge/LangChain-1C1C1C?style=for-the-badge" alt="LangChain" />
   <img src="https://img.shields.io/badge/Groq-FF6B35?style=for-the-badge" alt="Groq" />
</p>

BuildMyResume is a full-stack resume and portfolio platform that keeps one clean source of truth for your profile data, turns that data into polished resumes, tailors them to job descriptions with AI, and reuses the same content for portfolio workflows.

The project is designed around one practical goal: reduce repetitive resume editing and make every application faster, more targeted, and easier to maintain.

## Quick Tags

- AI-tailored resumes
- Profile-first data model
- Clean PDF export
- JD match scoring
- Portfolio reuse
- One-click generation
- One-click portfolio deployment
- GitHub portfolio publishing
- BuildMyResume branding

## What It Does

BuildMyResume gives you:

- A profile/settings area to store your core identity, contact details, education, skills, experience, achievements, and links.
- A resume builder that can generate a clean, exportable resume from your stored profile data.
- An AI Tailor flow that analyzes a job description, ranks your saved data against the JD, and produces a final tailored resume preview.
- A portfolio system that can publish a deployed personal website from one click and also push the portfolio to GitHub.
- Export and save flows for PDFs and resume artifacts.

## Why It Feels Useful

The app is built to feel like a career workspace rather than a one-off resume editor.

- Your data lives once, then flows into builder, tailor, preview, and portfolio screens.
- AI is used for ranking, grounding, and shaping content, not for writing random prose.
- The final result stays structured, readable, and easy to export.

## Product Tags

<p align="left">
   <img src="https://img.shields.io/badge/Resume-Builder-0EA5E9?style=flat-square" alt="Resume Builder" />
   <img src="https://img.shields.io/badge/AI-Tailoring-F97316?style=flat-square" alt="AI Tailoring" />
   <img src="https://img.shields.io/badge/JD-Matching-22C55E?style=flat-square" alt="JD Matching" />
   <img src="https://img.shields.io/badge/Portfolio-Ready-8B5CF6?style=flat-square" alt="Portfolio Ready" />
   <img src="https://img.shields.io/badge/PDF-Export-111827?style=flat-square" alt="PDF Export" />
</p>

## Core Idea

The app follows a simple principle:

**Store profile data once, reuse it everywhere.**

Instead of manually rewriting your resume for every job, BuildMyResume keeps a structured master profile and uses that data to:

- build a base resume,
- tailor the resume for a specific JD,
- generate a preview,
- save the final version,
- and keep the same profile data available for portfolio generation.

That means the platform is not just a resume editor. It is a profile-driven career toolkit.

## Flagship Feature

The strongest part of BuildMyResume is the portfolio publish flow.

With one click, the app can take your saved data and turn it into a deployed portfolio website instead of just a static profile page. If you want the same portfolio represented in your code hosting workflow, it can also be pushed directly to GitHub.

That makes the app useful in two directions at once:

- a live deployed portfolio website you can share immediately,
- and a GitHub-backed source artifact you can keep versioned.

## Tech Stack At a Glance

<p align="left">
   <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
   <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
   <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
   <img src="https://img.shields.io/badge/Radix_UI-111827?style=flat-square" alt="Radix UI" />
   <img src="https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
   <img src="https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=000000" alt="Firebase" />
   <img src="https://img.shields.io/badge/Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
   
</p>

| Area | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, shadcn-style components |
| State / Data | React Hook Form |
| UI / Motion | Framer Motion, Sonner, lucide-react, Recharts, react-router-dom |
| PDF / Preview | jsPDF, html2canvas |
| Authentication | Firebase client auth, Firebase Admin |
| Backend API | Express 5, Node.js, Mongoose, MongoDB |
| AI / Orchestration | LangChain, Groq SDK, @langchain/groq, @langchain/core |
| File / Resume Processing | multer, mammoth, pdf-parse, tesseract.js, jszip |
| Security / Middleware | helmet, cors, compression, cookie-parser, express-rate-limit, morgan |
| Deployment / Integrations | Cloudflare Pages, Groq API, MongoDB connection, Firebase services |

## Why This Stack

### Frontend: React + TypeScript + Vite

Why this choice:

- React gives component-based rendering for complex form flows and preview UIs.
- TypeScript helps keep resume/profile data shapes consistent across builder, tailor, and preview screens.
- Vite provides fast local development and production builds.

Why not a heavier frontend framework:

- The product is form-heavy and preview-heavy, not a server-rendered content site.
- Vite + React keeps the bundle lean and the iteration speed high.
- The app needs lots of reusable UI pieces, not a framework-specific opinionated architecture.

### UI System: Tailwind CSS + shadcn/Radix

Why this choice:

- Resume tooling is highly interactive, so accessible primitives matter.
- Radix gives robust accessible components.
- Tailwind makes it easy to control layout density, typography, and spacing in resume previews.
- shadcn-style composition keeps the UI customizable without locking into a closed design system.

### Backend: Express + MongoDB + Mongoose

Why this choice:

- Express is simple and direct for API-heavy apps.
- MongoDB fits profile data, project data, and nested resume structures naturally.
- Mongoose provides schema validation and structured persistence for nested objects.

Why not a relational-only model:

- Resume/profile data changes shape over time.
- Nested sections like education, skills, experience, and achievements are easier to store and evolve in document form.

### Authentication: Firebase

Why this choice:

- Firebase handles user authentication cleanly on the frontend.
- The backend verifies Firebase ID tokens rather than managing passwords directly.
- This reduces auth complexity while keeping the app secure.

### AI Layer: Groq + LangChain

Why this choice:

- Groq gives fast LLM response time for tailored text generation.
- LangChain is used for structured orchestration and guided output.
- The app needs deterministic output shape more than open-ended chat.

Why structured orchestration matters:

- Resume content must be predictable.
- Free-form AI text is not enough for a resume builder.
- The pipeline has to return specific fields like ranked skills, chosen projects, and final tailored JSON.

### PDF Export: jsPDF

Why this choice:

- The final resume is rendered client-side.
- jsPDF avoids forcing a server-side PDF rendering dependency.
- It gives direct control over line spacing, page breaks, fonts, and export behavior.

### Deployment and Platform Services

Why these are part of the stack:

- Cloudflare Pages is used for direct static deployment flows where the app publishes built assets.

- Firebase handles authentication and identity, so the app does not need to own password storage.
- MongoDB keeps the profile and resume documents flexible enough to evolve with the product.

### Backend Utilities and Parsing Tools

These libraries support the parts of the app that are easy to underestimate but important in practice:

- `multer` for file uploads.
- `mammoth` for DOCX extraction.
- `pdf-parse` for reading uploaded PDFs.
- `tesseract.js` for OCR-style extraction when needed.
- `jszip` and `form-data` for packaging and upload flows.
- `helmet`, `cors`, `compression`, `morgan`, and `express-rate-limit` for hardening and observability.
- `zod` for schema validation across structured payloads.

## Product Architecture

BuildMyResume is built as a monorepo with two main applications:

- `backend/` - API, auth, persistence, AI orchestration, and profile management.
- `frontend/` - user-facing dashboard, resume builder, AI tailor, preview, and export flow.

### High-Level Flow

1. User signs in with Firebase.
2. Frontend obtains a Firebase ID token.
3. Backend verifies the token and loads the stored user profile.
4. User updates master profile data in Settings.
5. Resume Builder uses that data to generate a normal resume.
6. AI Tailor takes a job description and the same master data, then:
   - analyzes the JD,
   - ranks the user data against the JD,
   - generates tailored JSON,
   - produces a final preview,
   - and saves the final resume.
7. Portfolio-related services reuse the same profile/project data.

## AI Tailoring Architecture

The AI tailoring flow is intentionally not a chat experience. It is an orchestration pipeline.

### Pipeline Steps

#### 1. JD Analysis

The job description is parsed into structured requirements such as:

- primary tech stack
- secondary skills
- responsibilities
- ATS keywords
- role title
- seniority

#### 2. Master Data Matching

The user's stored profile data is scored against the JD.

This includes:

- skills
- projects
- experience
- achievements

The system does not just pick the top 3 records blindly. It compares all candidate data and ranks it against the JD.

#### 3. JSON Transformation

The selected content is then transformed into final tailored resume JSON.

This output powers the final preview and save flow.

### Why This Approach

Why not generate plain resume text directly:

- Plain text is hard to validate and reuse.
- JSON is easier to map into structured UI sections.
- It is safer for preview, export, and future edits.

Why not let the model freely write the resume:

- Resume content needs hard limits and predictable structure.
- Overly free-form output tends to hallucinate or over-explain.
- Structured output keeps the final resume cleaner and more consistent.

### Tailoring Rules Used in the App

- Max 3 final projects in the tailored resume.
- Project bullets are forced to be concrete and resume-like.
- STAR is used internally, but labels are not shown.
- Output is sanitized so it reads like a resume, not an AI explanation.
- Suggested gap analysis is included to show what is missing and what to improve.

## Features

### Profile and Settings

- Store name, email, phone, LinkedIn, GitHub, education, skills, experience, and achievements.
- Keep one master profile that powers all generated content.
- Phone number is editable and reused everywhere it is required.

### Resume Builder

- Build a resume from structured profile data.
- Seed data from stored profile fields.
- Preview the final resume before saving.
- Export as PDF.

### AI Tailor

- Paste a JD and generate a tailored resume.
- Get JD match scoring and gap analysis.
- See suggested skills and project improvements.
- Auto-generate a final preview through the Jake resume pipeline.
- Save the tailored result as a normal resume artifact.

### Portfolio and Projects

- Store projects with descriptions, stacks, and links.
- Reuse project data across builder, tailor, and portfolio flows.
- Rank projects against a JD when tailoring.
- Generate a deployed portfolio website in one click.
- Publish the portfolio directly to GitHub when needed.

### Dashboard

- View profile and resume activity.
- Navigate to resumes, projects, tailoring, portfolio, and settings.

## Data Model

The app centers around a user profile document that includes:

- identity: name, email, photo, phone
- social links: LinkedIn, GitHub
- education entries
- skills and grouped skill sections
- experience entries
- achievements
- custom domain and notification settings
- Vercel connection metadata

This structure is important because the same data powers multiple product areas.

## Backend Responsibilities

The backend is responsible for:

- Firebase token verification
- profile persistence
- resume record storage
- project storage and lookup
- AI orchestration and tailoring
- file upload handling
- dashboard/profile snapshots

### Why keep AI orchestration in the backend

- Keeps API keys and credentials hidden.
- Centralizes prompt logic and output validation.
- Makes frontend UI simpler.
- Gives a single place to adjust the resume logic without changing the user interface.

## Frontend Responsibilities

The frontend is responsible for:

- authentication flow
- settings UI
- resume builder UI
- AI Tailor page
- preview rendering
- export/save actions
- dashboard and project management screens

### Why keep export client-side

- Faster preview loops.
- Less server load.
- Direct control over typography and page layout.
- Easier iteration on resume formatting.

## Main User Flows

### 1. First-Time Setup

- Sign in with Google/Firebase.
- Open Settings.
- Add name, phone, links, education, skills, and experience.

### 2. Normal Resume Creation

- Open Resumes.
- Use the builder to generate a resume from saved profile data.
- Adjust content and save the final PDF.

### 3. AI Tailored Resume

- Paste a JD into AI Tailor.
- The system analyzes the JD and ranks your data.
- A final tailored JSON is generated.
- Preview is rendered.
- Save the final resume.

### 4. Portfolio Content Reuse

- Projects stored in profile data can be reused for portfolio generation and AI matching.

## Repository Structure

- `backend/` - Express API, MongoDB models, AI services, auth, and routes.
- `frontend/` - React app with dashboard, builder, tailoring, and preview components.

## Environment Overview

### Backend

Typical backend requirements include:

- Firebase Admin credentials
- MongoDB connection string
- Groq API key
- JWT/auth related environment values
- Vercel integration values if portfolio deployment is used

### Frontend

Typical frontend requirements include:

- Firebase client config
- API base URL
- build-time Vite environment values

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Build and Test

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm run build
```

## Design Decisions

### Why a single profile source of truth

Because duplicated data creates drift. If phone, links, skills, and project details live in multiple places, the resume and portfolio eventually diverge.

### Why the AI does ranking rather than full rewriting

Because ranking is safer and more explainable. The model selects relevant content, then the app renders it in a stable resume structure.

### Why the app keeps a structured preview before saving

Because the user should see what will be exported before it becomes a PDF artifact.

### Why the final resume is saved as a standard resume file

Because the generated output should behave like any other uploaded resume in the app, not as a special one-off AI artifact.

## Status

The project currently emphasizes:

- strong profile-driven resume generation
- a controlled AI tailoring pipeline
- reusable project and skill data
- clean PDF preview and export
- branding consistency under BuildMyResume

## Roadmap Ideas

Possible next improvements:

- more explicit project recommendation explanations in the UI
- stronger section-level scoring visualization
- additional resume templates
- richer portfolio publishing options
- role-specific tailoring presets for DevOps, frontend, backend, and ML jobs

## Summary

BuildMyResume is a profile-first, AI-assisted resume platform built to reduce manual rewriting and keep your job application materials consistent across resumes, portfolios, and tailored JD outputs.

The main design choice is simple:

- store everything once,
- structure it well,
- use AI only where it adds value,
- and render the final output in a clean, predictable format.
