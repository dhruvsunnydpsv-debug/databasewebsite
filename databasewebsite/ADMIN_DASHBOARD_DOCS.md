# SAT Admin Dashboard - Technical Documentation

This document outlines the architecture, security, and scaling strategy for the production-ready SAT Admin Dashboard.

## 1. Hosting & Accessibility

### Where is it hosted?

The admin dashboard is hosted on the same infrastructure as the student site (e.g., Vercel, Netlify, or AWS). It exists as a private route under the `/admin` path of the main domain.

### Why is it "Public but not Accessible"?

The URL is technically "public" (anyone can type `/admin` in their browser), but it is NOT "publicly accessible" because:

- **Authentication**: A valid email and password are required to enter.
- **Role-Based Access Control (RBAC)**: Even if a student creates an account, they cannot access the dashboard because their `role` in the `profiles` table is set to `student` by default. Only users with `role = 'admin'` can see the dashboard content.
- **Middleware**: Every request to `/admin/*` is intercepted by a security layer that checks for a valid admin session.

## 2. Admin Collaboration

### How two admins collaborate safely:

- **Centralized Database**: Both admins connect to a single Supabase PostgreSQL instance.
- **Real-time Updates**: Changes made by one admin (e.g., editing a question) are reflected instantly for the other upon page refresh or data re-fetch.
- **Audit Logs**: The `/admin/audit` tool (implemented) allows admins to track changes and verify question synthesis side-by-side.
- **Concurrency**: PostgreSQL handles concurrent writes (locking) to ensure that if both admins try to edit the same question at the EXACT same millisecond, the database maintains integrity.

## 3. Data Flow

**Admin → Database → Student Site**

1. **Admin**: Uploads a CSV or edits a question in the dashboard.
2. **Database (Supabase)**: Stores the question in the `sat_question_bank` table.
3. **Student Site**: The student-facing frontend fetches questions via the Supabase API. It filters for `is_enabled = TRUE`, ensuring students only see "active" questions.

## 4. Security Enforcement

- **Database Layer (RLS)**: Row Level Security is enabled on the `sat_question_bank` table.
  - `SELECT`: Publicly available (for habilitated questions).
  - `INSERT/UPDATE/DELETE`: Restricted to users whose `profiles.role` is 'admin'.
- **API Layer**: Supabase Service Role Keys are kept server-side (in `.env` files) and never exposed to the client. The client uses "Anon" keys which are governed by the RLS policies mentioned above.
- **UI Layer**: The sidebar and admin pages use a `useAuth` hook and a wrapper component to redirect unauthorized users before any data is even fetched.

## 5. Scaling to 5,000+ Questions

- **Server-Side Pagination**: We do NOT load all 5,000 questions into the browser. We use `.range(from, to)` in Supabase queries to fetch only 15 questions at a time.
- **Indexing**: Database indexes are created on `module`, `domain`, `difficulty`, and `is_enabled` to ensure that filtering through thousands of rows takes milliseconds.
- **Bulk Operations**: The Ingestion engine handles batch inserts (e.g., 500 questions at once) rather than 500 individual API calls, which is much more efficient.

---

### Database Schema Recap

- **sat_question_bank**: stores content, metadata, and status (`is_enabled`).
- **profiles**: stores user-specific data, primarily the `role`.
- **auth.users** (Supabase Internal): manages credentials and sessions.
