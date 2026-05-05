<<<<<<< HEAD
# RETC Training Management System

## What is this system?

The **RETC Training Management System** is a **web application** for **RETC** (and similar training operations) to run day-to-day **training administration** in one place. Instead of juggling spreadsheets, separate tools, and informal lists, staff use this app to **record who is being trained**, **which programs exist**, **who delivers them**, **which partners are involved**, and **how participation is tracked**—with **role-based access** so only the right people can change sensitive data.

### What problem does it solve?

Training organizations need to:

- Keep an **accurate register of trainees** (contact details, cohort, location, progress signals).
- Plan and maintain **training programs** (schedules, capacity, status, assignment to trainers).
- Coordinate **trainers** and **partner organizations** linked to programs.
- Understand **enrollment** (who is on which program) for reporting and operations.
- See **high-level analytics** (e.g. distributions and trends) and produce **formal reports** (PDF exports) for stakeholders.

This system supports those needs by storing structured data in **Appwrite** and exposing it through a **browser-based dashboard** built with **Next.js**.

### Who uses it?

Two kinds of **internal staff** accounts are modeled in the database (`users` collection), aligned with **Appwrite Authentication**:

| Role | Purpose |
|------|--------|
| **Admin** | Full operational control: create, edit, and delete trainees, programs, trainers, partners, and related links; run imports; access analytics and reports. |
| **Manager** | Oversight and reporting: can view the same operational picture and use analytics and **PDF reports**, with **no** ability to change core records (read-focused workflow). |

End **trainees** and external partners do not log into this app by default—it is an **internal operations console** for RETC staff.

### What can you do in the app (conceptually)?

- **Dashboards** tailored to admin vs manager (overview and entry points).
- **Trainees**: maintain trainee records; **bulk-import** from CSV where configured.
- **Programs**: define and track training programs (titles, dates, status, links to trainers/partners as your schema supports).
- **Trainers** and **partners**: maintain directories and associate them with programs.
- **Enrollments**: relate trainees to programs when your data model uses enrollments.
- **Analytics**: charts and summaries for program and participant patterns.
- **Reports**: generate **PDF** exports with filters (e.g. by year, program, partner, trainer) for registered trainees and programs.

All of this is **backed by Appwrite**: the app uses **email/password login**, then reads and writes documents in your **database collections** according to the IDs you configure in environment variables (see below).

### How it fits together (simple picture)

```text
Staff browser  →  This Next.js app  →  Appwrite (Auth + Database)
                                           ↑
                                    Your collections & permissions
```

You **configure** Appwrite (project, database, collections, security rules) and **point** the app at it via `.env`. In **production**, every logged-in user must have a matching row in the **`users`** collection (same email as Auth) so the app knows their **role**—it does not grant admin access without that record.

---

## Tech stack

- **App**: Next.js, React, JavaScript (JSX)
- **Data & auth**: Appwrite (Auth + Databases)
- **UI**: Tailwind CSS, shadcn-style components
- **Charts**: Recharts (analytics)

## Features (at a glance)

- **Authentication**: Appwrite Auth + profile row in **`users`** for role (`admin` / `manager`).
- **Directories**: Trainees, programs, trainers, partners; program–partner relationships; enrollments where used.
- **Operations**: CSV trainee import; filtered **PDF** reports; analytics dashboard.
- **Production safety**: No synthetic admin users—database profile required (see `.env.example`).

## Prerequisites

- **Node.js 18+** and **npm** (or pnpm)
- An **Appwrite** project (Cloud or self-hosted)

## Local setup

### 1. Install

```bash
npm install
```

### 2. Appwrite: project, database, collections

1. Create a project in [Appwrite Cloud](https://cloud.appwrite.io) (or your self-hosted URL).
2. Note the **API endpoint** and **Project ID** (Settings).
3. Under **Databases**, create a database and note its **Database ID** (e.g. you can name it `training_system`).
4. Create collections whose **IDs** you will paste into env vars. The app expects these IDs in `lib/appwrite.js` / `.env.example`:
   - `users`
   - `trainees`
   - `training_programs` (or your programs collection ID)
   - `analytics_events`
   - Plus any others your deployment uses: **trainers**, **enrollments**, **partners**, **program_partners** (see `.env.example`).

**Example attributes** (adjust to match what you already store; Appwrite Auth handles passwords—your `users` rows typically hold email, name, role, status, etc.):

| Collection        | Typical fields |
|-------------------|----------------|
| users             | email, name, role (`admin` / `manager`), status |
| trainees          | email, name, phone, gender, district, qualification, status, program links as your schema defines |
| training_programs | title, description, dates, capacity, status, trainer/partner refs as needed |
| analytics_events  | event_type, metadata, timestamps (if used) |

Set **collection permissions** in Appwrite so client SDK calls from this app succeed (read/write per role as you require).

### 3. Environment variables

Copy `.env.example` to `.env.local` (or `.env`) and fill in values. Never commit real secrets.

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID=...
NEXT_PUBLIC_APPWRITE_TRAINEES_COLLECTION_ID=...
NEXT_PUBLIC_APPWRITE_PROGRAMS_COLLECTION_ID=...
NEXT_PUBLIC_APPWRITE_ANALYTICS_COLLECTION_ID=...
# …see .env.example for trainers, enrollments, partners, program_partners
```

Optional server-only key (for scripts or future server routes): `APPWRITE_API_KEY` — do **not** expose as `NEXT_PUBLIC_*`.

### 4. First user

- Create an Auth user in Appwrite (Authentication) if you use email/password login.
- Add a matching document in the **`users`** collection with the **same email** and the desired **role** (`admin` or `manager`).

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

Stop the dev server before building if Windows locks `.next` files.

## Deployment (e.g. Vercel)

1. Push the repo to your Git host.
2. Import the project on Vercel (or another host that supports Next.js).
3. Set the same env vars as in `.env.example` in the host’s **Environment Variables** UI.
4. Do not commit `.env.local` / `.env` with secrets.

**Production auth:** With `NODE_ENV=production`, the app does not invent admin users; each session must align with your `users` collection (see `.env.example`).

## CSV import (trainees)

Expected columns include at least **`email`** and **`name`**; optional columns such as phone, gender, district, qualification depend on your schema. Large files are supported up to the limit configured in the import UI.

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Login fails | Auth user exists; `users` row exists with same email and role; env IDs correct; network to Appwrite |
| Empty data / errors | Collection IDs and DB ID match Appwrite; collection permissions allow your client |
| Build fails on Windows | Close dev server; delete `.next` if locked; retry `npm run build` |

## Docs

- [Appwrite](https://appwrite.io/docs)  
- [Next.js](https://nextjs.org/docs)

## License

Built for the RETC organization.
=======
# RETC-Training-Management-System
The RETC Training Management System is RETC’s internal web platform for operating training programmes end-to-end: maintaining participant, programme, trainer, and partner records; supporting operational analytics and document exports; and enforcing role-based administration for authorised staff. Implemented with Next.js and Appwrite.
>>>>>>> 0ddd92bc84295eacca942a22e4baf271d16ecd41
