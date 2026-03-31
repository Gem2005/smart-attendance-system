# Smart Attendance System

A multi-layered anti-proxy attendance system with QR + Geofencing + WiFi SSID verification + Photo proof.

| Layer | Tech |
|-------|------|
| Web (Faculty) | Next.js 14 (App Router) + shadcn/ui + Tailwind CSS |
| Mobile (Student) | React Native (Expo SDK 51) — iOS & Android |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Monorepo | pnpm workspaces |

---

## Vision Document

### Project Overview
**Name:** Smart Attendance System
**Problem it Solves:** Traditional roll-calls are time-consuming, and existing digital solutions (like simple QR codes) are easily manipulated for proxy attendance via screenshot sharing or remote scanning.
**Target Users (Personas):** 
1. **Teacher/Faculty:** Needs to quickly take verifiable attendance, monitor live stats, and manage class records without wasting teaching time.
2. **Student:** Needs a frictionless way to mark their presence securely using their own smartphone.
3. **Admin:** Needs to oversee system usage and manage top-level configuration.

### Vision Statement
To provide a highly secure, location-aware, and proxy-proof digital attendance application that eliminates manual roll-calls while ensuring 100% attendance integrity through a seamless multi-layered verification chain (Time + QR + GPS + WiFi + Photo).

### Key Features & Goals
- **Multi-Factor Verification:** Dynamic QR, Geofencing, WiFi SSID matching, and selfie capture.
- **Auto-rotating QR:** Changes every 30 seconds to prevent barcode scraping/sharing.
- **Real-time Dashboard:** Teachers see live attendance updates as students scan.
- **Data Isolation:** Teachers only see their classes; students only see their own attendance logs.

### Success Metrics
- 100% elimination of proxy attendance in deployed classrooms.
- < 15 seconds average time for a student to successfully mark attendance.
- 99.9% system uptime and reliable verification within campus bounds.

### Assumptions & Constraints
- **Assumptions:** Students possess a smartphone with a working camera, GPS, and WiFi. Classrooms have steady internet and at least one verifiable WiFi SSID.
- **Constraints:** Network reliability in certain campus dead zones; iOS platform restrictions on ambient WiFi SSID scanning (requiring fallbacks).

---

## Table of Contents

1. [Attendance Flow](#1-attendance-flow)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [RLS & Data Isolation](#4-rls--data-isolation)
5. [Web App — Feature Breakdown](#5-web-app--feature-breakdown)
6. [Mobile App — Feature Breakdown](#6-mobile-app--feature-breakdown)
7. [Implementation Phases](#7-implementation-phases)
8. [Tech Stack Details](#8-tech-stack-details)
9. [Environment Variables](#9-environment-variables)

---

## 1. Attendance Flow

```
Teacher (Web)                                   Student (Mobile)
─────────────                                   ────────────────
1. Select class + session                       
2. Generate QR code ──────────────────────────► 3. Scan QR code
   (QR contains: session_id,                       │
    class_id, timestamp, HMAC)                     ▼
                                                4. Validate class timing
                                                   (is current time within
                                                    scheduled slot?)
                                                   │ ✅
                                                   ▼
                                                5. Check geofence
                                                   (GPS lat/lng within
                                                    radius of class location)
                                                   │ ✅
                                                   ▼
                                                6. Scan WiFi SSIDs
                                                   (match teacher's configured
                                                    SSID, signal ≥ -50 dBm
                                                    i.e. "excellent" range,
                                                    NO connection needed)
                                                   │ ✅
                                                   ▼
                                                7. Capture & upload selfie
                                                   (stored in Supabase Storage,
                                                    path scoped to student)
                                                   │ ✅
                                                   ▼
                                                8. Attendance record created
                                                   (status: present, with all
                                                    verification metadata)
                                                   │
   ◄──────────────────────────────────────────────┘
9. Dashboard shows live
   attendance + photo + 
   verification details
```

### QR Code Payload (JSON, HMAC-signed)

```jsonc
{
  "sid": "uuid",          // attendance_session id
  "cid": "uuid",          // class id
  "iat": 1741500000,      // issued-at unix timestamp
  "exp": 1741500300,      // expires (5 min window)
  "hmac": "sha256-hex"    // HMAC-SHA256(sid+cid+iat+exp, SERVER_SECRET)
}
```

- QR rotates every **30 seconds** (teacher's web app auto-regenerates).
- HMAC prevents forgery — server validates signature before accepting.
- 5-minute expiry window prevents screenshot sharing.

### Verification Chain (all must pass — in order)

| Step | Check | Fail → |
|------|-------|--------|
| 1 | QR signature valid + not expired | "Invalid or expired QR code" |
| 2 | Current time within class schedule (±5 min buffer) | "Class is not in session" |
| 3 | Student GPS within geofence radius of class location | "You are not near the classroom" |
| 4 | Configured WiFi SSID found with signal ≥ -50 dBm | "Campus WiFi not detected nearby" |
| 5 | Photo uploaded | "Photo required" |

---

## 2. Project Structure

```
smart-attendance-system/
├── apps/
│   ├── web/                          # Next.js 14 — Teacher dashboard
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── classes/
│   │   │   │   │   ├── [classId]/
│   │   │   │   │   │   ├── students/
│   │   │   │   │   │   ├── attendance/
│   │   │   │   │   │   ├── qr/
│   │   │   │   │   │   └── settings/
│   │   │   │   │   └── page.tsx       # All classes list
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx       # Overview stats
│   │   │   │   └── layout.tsx         # Sidebar + header
│   │   │   ├── api/
│   │   │   │   ├── qr/generate/
│   │   │   │   └── attendance/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn components
│   │   │   ├── qr-generator.tsx
│   │   │   ├── attendance-table.tsx
│   │   │   ├── class-card.tsx
│   │   │   └── student-form.tsx
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts          # Browser client
│   │   │   │   ├── server.ts          # Server client (RSC)
│   │   │   │   └── middleware.ts      # Auth middleware
│   │   │   ├── qr.ts                  # QR generation + HMAC
│   │   │   └── utils.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── mobile/                        # React Native (Expo)
│       ├── app/                       # Expo Router (file-based)
│       │   ├── (auth)/
│       │   │   └── login.tsx
│       │   ├── (tabs)/
│       │   │   ├── scan.tsx           # QR scanner tab
│       │   │   ├── history.tsx        # Attendance history
│       │   │   └── profile.tsx
│       │   └── _layout.tsx
│       ├── components/
│       │   ├── qr-scanner.tsx
│       │   ├── geofence-check.tsx
│       │   ├── wifi-scanner.tsx
│       │   └── photo-capture.tsx
│       ├── lib/
│       │   ├── supabase.ts
│       │   ├── location.ts            # Geofencing logic
│       │   ├── wifi.ts                # WiFi SSID scanning
│       │   └── verification.ts        # Orchestrates the chain
│       ├── app.json
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── supabase/                      # DB migrations & types
│   │   ├── migrations/
│   │   │   ├── 001_create_tables.sql
│   │   │   ├── 002_rls_policies.sql
│   │   │   └── 003_seed_data.sql
│   │   ├── config.toml
│   │   ├── types/
│   │   │   └── database.ts            # Generated from Supabase
│   │   └── package.json
│
├── .env.example
├── .gitignore
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 3. Database Schema

### Entity Relationship

```
teachers ──┐
           ├──► class_teacher_assignments ◄── classes
students ──┤                                    │
           ├──► class_enrollments ◄─────────────┤
           │                                    │
           └──► attendance_records ◄── attendance_sessions
                                          │
                                    class_locations
                                    wifi_configs
```

### Tables

#### `teachers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = auth.users.id |
| email | text UNIQUE | login credential |
| full_name | text | |
| department | text | nullable |
| created_at | timestamptz | default now() |

#### `students`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = auth.users.id |
| email | text UNIQUE | login credential |
| full_name | text | |
| roll_number | text UNIQUE | |
| phone | text | nullable |
| created_at | timestamptz | default now() |

#### `classes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| name | text | e.g. "Data Structures - Sec A" |
| code | text UNIQUE | e.g. "CS201-A" |
| building | text | e.g. "Block C" |
| room_number | text | e.g. "301" |
| created_at | timestamptz | default now() |

#### `class_schedules`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| class_id | uuid FK → classes | |
| day_of_week | int | 0=Sun … 6=Sat |
| start_time | time | e.g. 09:00 |
| end_time | time | e.g. 10:00 |

#### `class_teacher_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| class_id | uuid FK → classes | |
| teacher_id | uuid FK → teachers | |
| UNIQUE | (class_id, teacher_id) | |

#### `class_enrollments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| class_id | uuid FK → classes | |
| student_id | uuid FK → students | |
| enrolled_at | timestamptz | default now() |
| UNIQUE | (class_id, student_id) | |

#### `class_locations` (geofence config)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| class_id | uuid FK → classes | UNIQUE |
| latitude | double precision | center of geofence |
| longitude | double precision | center of geofence |
| radius_meters | int | default 100 |

#### `wifi_configs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| class_id | uuid FK → classes | |
| teacher_id | uuid FK → teachers | |
| ssid | text | WiFi network name to match |
| min_signal_dbm | int | default -50 (excellent) |
| UNIQUE | (class_id, teacher_id) | |

#### `attendance_sessions` (one per QR generation event)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | embedded in QR |
| class_id | uuid FK → classes | |
| teacher_id | uuid FK → teachers | |
| session_date | date | |
| started_at | timestamptz | when QR was first generated |
| expires_at | timestamptz | session window end |
| qr_payload | jsonb | full QR data for audit |
| is_active | boolean | default true |

#### `attendance_records`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| session_id | uuid FK → attendance_sessions | |
| student_id | uuid FK → students | |
| class_id | uuid FK → classes | |
| status | text | 'present' / 'absent' / 'manual' |
| scanned_at | timestamptz | nullable (null if manual) |
| gps_latitude | double precision | student's GPS at scan |
| gps_longitude | double precision | student's GPS at scan |
| geofence_passed | boolean | |
| wifi_ssid_found | text | SSID detected (nullable) |
| wifi_signal_dbm | int | signal strength (nullable) |
| wifi_passed | boolean | |
| photo_url | text | Supabase Storage path |
| marked_by | text | 'system' or 'teacher' |
| notes | text | teacher's manual note |
| created_at | timestamptz | default now() |
| UNIQUE | (session_id, student_id) | no duplicate attendance |

### Supabase Storage Buckets

| Bucket | Path Pattern | Access |
|--------|-------------|--------|
| `attendance-photos` | `/{class_id}/{session_id}/{student_id}.jpg` | Private — RLS: student can upload own, teacher of class can read |

---

## 4. RLS & Data Isolation

Every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

### Core Policies

```sql
-- Teachers can only see classes assigned to them
CREATE POLICY "teachers_own_classes" ON classes FOR SELECT
  USING (id IN (
    SELECT class_id FROM class_teacher_assignments
    WHERE teacher_id = auth.uid()
  ));

-- Students can only see classes they are enrolled in
CREATE POLICY "students_own_classes" ON classes FOR SELECT
  USING (id IN (
    SELECT class_id FROM class_enrollments
    WHERE student_id = auth.uid()
  ));

-- Attendance records: teacher sees records of their classes
CREATE POLICY "teacher_view_attendance" ON attendance_records FOR SELECT
  USING (class_id IN (
    SELECT class_id FROM class_teacher_assignments
    WHERE teacher_id = auth.uid()
  ));

-- Attendance records: student sees only their own
CREATE POLICY "student_own_attendance" ON attendance_records FOR SELECT
  USING (student_id = auth.uid());

-- Students can only INSERT their own attendance
CREATE POLICY "student_mark_attendance" ON attendance_records FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Teachers can INSERT/UPDATE attendance (manual marking)
CREATE POLICY "teacher_manage_attendance" ON attendance_records
  FOR ALL USING (class_id IN (
    SELECT class_id FROM class_teacher_assignments
    WHERE teacher_id = auth.uid()
  ));

-- Storage: students upload only to their own path
-- Storage: teachers read photos of their class students
```

### Auth Roles

- Supabase Auth with **email + password** for both teachers and students.
- Custom claim `role` in JWT: `'teacher'` or `'student'`.
- Set via a Supabase database function triggered on signup / admin action.
- Middleware in Next.js checks role before rendering dashboard routes.
- Mobile app checks role to restrict to student-only screens.

### Data Isolation Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| Teacher A cannot see Teacher B's classes | RLS on `classes` via `class_teacher_assignments` |
| Student A cannot see Student B's attendance | RLS: `student_id = auth.uid()` |
| Student cannot mark attendance for another student | RLS: INSERT `WITH CHECK (student_id = auth.uid())` |
| QR codes cannot be forged | HMAC-SHA256 signature validated server-side |
| Photo storage is scoped | Storage RLS: path must contain student's own UUID |
| No direct DB access | All access via Supabase client (anon key + RLS) |

---

## 5. Web App — Feature Breakdown

### Pages & Components

| Route | Feature | Key Components |
|-------|---------|----------------|
| `/login` | Teacher login | Email + password form |
| `/dashboard` | Overview | Stats cards (total classes, today's sessions, attendance %) |
| `/classes` | Class list | Cards with class name, schedule, student count |
| `/classes/[id]` | Class detail | Tabs: Students, Attendance, QR, Settings |
| `/classes/[id]/qr` | QR Generator | Live QR display, auto-rotate timer, session controls |
| `/classes/[id]/students` | Student mgmt | Table with add/edit/remove, search, bulk import CSV |
| `/classes/[id]/attendance` | Attendance log | Date picker, table (name, status, time, GPS, WiFi, photo thumbnail), export CSV |
| `/classes/[id]/settings` | Class config | Edit building/room, geofence (map picker for lat/lng/radius), WiFi SSID |

### QR Generation (Server-Side)

- **API Route**: `POST /api/qr/generate`
- Creates `attendance_session` row in DB.
- Signs payload with `HMAC-SHA256` using server-only secret.
- Returns QR data → web app renders via `qrcode` library.
- Client polls / uses Supabase Realtime to auto-rotate every 30s.

### Key Libraries (Web)

| Library | Purpose |
|---------|---------|
| `next` 14 | App Router, RSC, API Routes |
| `@supabase/ssr` | Supabase client for Next.js (SSR-safe) |
| `shadcn/ui` | UI components (Table, Card, Dialog, Form, Tabs…) |
| `qrcode` | QR code image generation |
| `react-hook-form` + `zod` | Form handling + validation |
| `date-fns` | Date/time formatting |
| `leaflet` or `@vis.gl/react-google-maps` | Map picker for geofence config |
| `recharts` | Dashboard charts |

---

## 6. Mobile App — Feature Breakdown

### Screens

| Screen | Feature |
|--------|---------|
| Login | Student email + password |
| Scan (Tab) | Camera QR scanner → verification flow |
| Verification | Step-by-step progress (QR ✓ → Time ✓ → Location ✓ → WiFi ✓ → Photo ✓) |
| History (Tab) | List of attendance records grouped by class |
| Profile (Tab) | Student info, enrolled classes |

### Verification Flow (orchestrated in `lib/verification.ts`)

```typescript
async function verifyAttendance(qrData: QRPayload): Promise<Result> {
  // 1. Validate HMAC + expiry (call Supabase edge function)
  await verifyQRSignature(qrData);

  // 2. Check class timing
  const schedule = await getClassSchedule(qrData.cid);
  assertWithinSchedule(schedule);

  // 3. Geofence check
  const location = await getCurrentGPS();
  const classLocation = await getClassLocation(qrData.cid);
  assertWithinGeofence(location, classLocation);

  // 4. WiFi SSID scan
  const networks = await scanNearbyWiFi();
  const wifiConfig = await getWiFiConfig(qrData.cid);
  assertWiFiMatch(networks, wifiConfig);

  // 5. Capture photo
  const photoUri = await capturePhoto();
  const photoUrl = await uploadPhoto(photoUri, qrData);

  // 6. Submit attendance record
  await submitAttendance(qrData, location, networks, photoUrl);
}
```

### Key Libraries (Mobile)

| Library | Purpose |
|---------|---------|
| `expo` ~51 | Managed workflow |
| `expo-router` | File-based navigation |
| `expo-camera` | QR scanning + photo capture |
| `expo-location` | GPS + foreground location |
| `react-native-wifi-reborn` | WiFi SSID scanning (no connection) |
| `@supabase/supabase-js` | DB + Auth + Storage client |
| `react-native-reanimated` | Animations |

### Platform Notes

| Feature | iOS | Android |
|---------|-----|---------|
| WiFi scanning | Requires `NEHotspotHelper` entitlement (limited) — fallback: skip WiFi check on iOS or use `CNCopyCurrentNetworkInfo` for connected WiFi | `WifiManager.loadWifiList()` — works well |
| Location | `requestForegroundPermissionsAsync()` | Same |
| Camera | `requestCameraPermissionsAsync()` | Same |

---

## 7. Implementation Phases

### Phase 0 — Project Scaffold
- [ ] Initialize pnpm monorepo with workspaces
- [ ] Scaffold Next.js app (`apps/web`)
- [ ] Install & configure shadcn/ui + Tailwind
- [ ] Scaffold Expo app (`apps/mobile`)
- [ ] Init Supabase project (`packages/supabase`)
- [ ] Setup `.env.example` and environment config

### Phase 1 — Database & Auth
- [ ] Write migration `001_create_tables.sql` (all tables above)
- [ ] Write migration `002_rls_policies.sql` (all RLS policies)
- [ ] Configure Supabase Auth (email provider)
- [ ] Create DB function to set user role claim (`teacher` / `student`)
- [ ] Write seed script with sample data
- [ ] Generate TypeScript types from Supabase schema

### Phase 2 — Web App Core
- [ ] Auth: Login page + middleware (redirect if unauthenticated)
- [ ] Dashboard layout: Sidebar navigation + header
- [ ] Dashboard overview: Stats cards + charts
- [ ] Classes list page: CRUD for classes
- [ ] Class detail: Tabs layout

### Phase 3 — Web App Features
- [ ] Class settings: Building, room, geofence map picker, WiFi SSID config
- [ ] Class schedules: Day/time management
- [ ] Student management: Add/edit/remove students, CSV import
- [ ] QR code generation: API route + live display + auto-rotation
- [ ] Attendance view: Table with filters, verification details, photo preview
- [ ] Manual attendance editing: Teacher can mark/change status

### Phase 4 — Mobile App Core
- [ ] Auth: Student login screen
- [ ] Tab navigation: Scan, History, Profile
- [ ] Supabase client setup

### Phase 5 — Mobile App Verification Flow
- [ ] QR scanner: Camera-based scanning + decode + HMAC validation
- [ ] Timing check: Compare with class schedule
- [ ] Geofence check: GPS location vs class location radius
- [ ] WiFi SSID scan: Detect nearby networks + match + signal check
- [ ] Photo capture: Camera capture + upload to Supabase Storage
- [ ] Attendance submission: Create record with all metadata
- [ ] Verification UI: Step-by-step progress indicator

### Phase 6 — Mobile App Extras
- [ ] Attendance history: Grouped by class, date-wise records
- [ ] Profile screen: Student info, enrolled classes
- [ ] Push notifications (optional): Reminder when class starts

### Phase 7 — Integration & Hardening
- [ ] End-to-end testing: Full flow from QR generation to attendance record
- [ ] RLS audit: Verify all data isolation policies
- [ ] Error handling: Graceful failures at each verification step
- [ ] Rate limiting: Prevent brute-force QR attacks
- [ ] Input validation: Sanitize all inputs (zod schemas)

### Phase 8 — Deployment
- [ ] Web: Deploy to Vercel
- [ ] Mobile: Build with EAS (Expo Application Services)
- [ ] Supabase: Production project + environment variables
- [ ] Documentation: API docs, setup guide

---

## 8. Tech Stack Details

| Category | Choice | Why |
|----------|--------|-----|
| Web Framework | Next.js 14 (App Router) | RSC, API routes, middleware, great DX |
| UI Kit | shadcn/ui + Tailwind CSS | Accessible, composable, no vendor lock-in |
| Mobile | React Native + Expo SDK 51 | Cross-platform, managed workflow, OTA updates |
| Database | Supabase (PostgreSQL) | RLS, Auth, Storage, Realtime — all-in-one |
| Auth | Supabase Auth | JWT with custom claims, email/password |
| Storage | Supabase Storage | Private buckets with RLS for photos |
| QR Signing | HMAC-SHA256 | Tamper-proof QR payloads |
| Geofencing | Haversine formula | Distance between two GPS coordinates |
| WiFi Scanning | react-native-wifi-reborn | Read nearby SSIDs without connecting |
| Forms | react-hook-form + zod | Validated forms on web |
| Monorepo | pnpm workspaces | Simple, fast, no extra tooling |

---

## 9. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # Server-only, never expose to client

# QR Signing
QR_HMAC_SECRET=your-256-bit-secret     # Server-only

# Mobile (in app.json or .env)
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Local Development & Branching

### Repository Folder Structure
The repository is organized as a monorepo using `pnpm` workspaces:
- `apps/web`: Next.js frontend for teachers.
- `apps/mobile`: Expo React Native mobile app for students.
- `packages/supabase`: Database types and migrations.

### Branching Strategy (GitHub Flow)
We follow the standard GitHub Flow:
- `main`: The main branch is always stable, deployable, and production-ready.
- `feature/*` (e.g., `feature/add-docker`, `feature/auth-screens`): Created off `main` for developing new features. 
- `bugfix/*` or `hotfix/*`: For fixing system issues.
All branches must be merged into `main` via Pull Requests. 

### Local Development Tools
- **Code Editor:** VS Code (Extensions: ESLint, Prettier, Tailwind CSS, Docker).
- **Package Manager:** `pnpm` (v8+).
- **Subsystem Orchestration:** Docker & Docker Desktop for containerized environments.
- **Mobile Emulation:** Expo Go app natively, Android Studio Emulator, or iOS Simulator.
- **Database Local Dev:** Supabase CLI.

---

## Quick Start – Local Development

You can run the web architecture locally using Docker, which is pre-configured via `docker-compose`.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd smart-attendance-system

# 2. Make sure Docker Desktop is open and running!

# 3. Start the web application environment via Docker
docker compose up --build -d

# 4. View application startup logs to ensure Next.js is "Ready"
docker compose logs -f web

# 5. Access the app
# Open http://localhost:3000 in your browser
```

### Developing the Mobile App Locally
*(Note: Excluded from Docker as React Native requires native mobile toolchains)*
```bash
# Install repo dependencies
pnpm install

# Start the Expo bundler
pnpm --filter mobile start
```

---

**We follow Phase 0 → Phase 8 sequentially. Each phase represents a PR/commit boundary.**