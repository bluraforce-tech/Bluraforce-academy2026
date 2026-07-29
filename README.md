# Academy

Production-oriented educational platform built with Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/Storage, database RLS, Tailwind CSS, React Hook Form-compatible schemas, and Zod.

## Local setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Generate independent high-entropy secrets. The encryption key must be exactly 32 random bytes encoded as base64.
3. Link the Supabase CLI and apply `supabase/migrations` in order.
4. Run `npm install`, then `npm run dev`.

Never prefix service-role, HMAC, encryption, or invitation-code secrets with `NEXT_PUBLIC_`. Rotate any secret that has reached a browser, log, or repository.

## First administrator

Create a user in Supabase Authentication, then run this once in the SQL editor while replacing both values:

```sql
insert into public.profiles(id, role, full_name)
values ('AUTH_USER_UUID', 'admin', 'Platform Administrator');
```

Admin accounts use `/auth/admin/login`. An administrator must create every teacher through a trusted server operation using the service-role client, then insert the `profiles` and `teacher_profiles` records in one compensating workflow. Teachers have independent credentials and no public registration route.

## Database model and RLS

`profiles` provides immutable application roles. Role-specific details are split into teacher and student profiles. Enrolments are many-to-many and gate all teacher-owned content. Invitation codes are hashed, teacher-bound, one-time records redeemed under a row lock. Exams use immutable JSON snapshots in `exam_versions`; attempts store server timestamps and can never receive scores from the browser. Mistakes, videos, materials, notifications, and audit records retain explicit teacher/student ownership.

Every exposed table has RLS enabled. Admin access uses a security-definer role helper. Teacher policies always follow a teacher ownership key or active enrolment. Student policies use `auth.uid()` and assignments. Students never select correct choices, raw video records, material URLs, scores for mutation, or admin notifications. Sensitive mutations execute through narrowly granted functions or server routes. Private storage object names begin with the teacher UUID.

## Invitation codes and National IDs

Generate raw invitation codes only in server code with a cryptographically secure generator. Persist a peppered SHA-256 hash and masked suffix, and display the raw value once. Compute the same hash before calling `redeem_invitation_code`; the database locks the row and checks the selected teacher before creating an enrolment.

National IDs are normalized, HMAC-SHA256 hashed for unique comparison, AES-256-GCM encrypted for exceptional admin retrieval, and reduced to a last-four display value. Teachers never receive the encrypted field. Decryption belongs in an audited admin-only server route and must never return values to teacher or student clients.

## Video player

Students open only the internal route `/student/videos/[assignmentId]`. The server calls `get_video_player_data`; the video ID is returned only after authentication, assignment, active enrolment, teacher activity, publication, availability, revocation, and view-limit checks. Opening the page does not count a view. The YouTube IFrame API starts an idempotent server session on the first playback event. The iframe uses `youtube-nocookie.com`, stays inside a responsive container, and has no application-generated external YouTube link or navigation button.

Embedding does **not** make YouTube content fully private. Developer tools, network inspection, YouTube-controlled branding/behavior, screen recording, another recording device, and extraction or sharing of a discovered ID cannot be prevented. Playback telemetry is useful for normal controls and analytics but is not tamper-proof.

## Materials

Private Supabase Storage is recommended for protected materials. The signed-URL route verifies the authenticated student, active assignment, availability, and enrolment, then creates a five-minute URL and audits access. The `private-materials` bucket is non-public and protected by storage policies.

Google Drive is not protected by Supabase authentication. “Anyone with the link” files remain accessible to anyone who obtains the URL. Restricted files require Google Drive permission for the relevant Google accounts. Merely embedding or listing a Drive URL inside Academy does not make it private.

## Deployment

Deploy to a Next.js-compatible host over HTTPS. Configure production environment secrets in the host, use separate Supabase projects for development and production, restrict dashboard access, enable database backups and point-in-time recovery, configure Auth redirect URLs, and run migrations through CI before application rollout. Schedule a trusted job to submit expired attempts and process mistake-exam checkpoints.

## Security review

- Authorization is enforced server-side and with RLS; UI guards are only usability controls.
- Roles, ownership, scores, attempt expiry, code state, and view counts are never trusted from clients.
- Correct choices, National IDs, service credentials, raw codes, video IDs before authorization, and permanent protected-file URLs are not exposed.
- Transactional functions prevent timer restarts, double code redemption, and duplicated playback-session counting.
- Audit metadata must remain allow-listed and must never contain passwords, tokens, secrets, full National IDs, or raw invitation codes.
- Before production, execute the migration suite against a disposable Supabase project and run integration tests with admin, two teachers, and two students.
