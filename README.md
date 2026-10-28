# MedCode AI

**Bill accurately. Document confidently. Understand why.**

An educational portfolio application for hospitalist documentation, MDM, and billing education. **Synthetic data only. Never enter real patient information. This application is not HIPAA-compliant and is not for clinical care or actual billing decisions.**

## Phase 1

The initial project directory was empty. This implementation adds:

- A responsive navy, white, soft blue, and teal landing page.
- Email/password registration with password confirmation, server validation, email normalization, a synthetic-data acknowledgement, and bcrypt hashing (cost 12).
- Auth.js v5 Credentials login, encrypted JWT sessions with an eight-hour lifetime, and server-action logout. Auth.js manages session cookies and its authentication request protections. Next.js validates origins for server actions.
- A protected dashboard and user-scoped list/detail queries. Every data helper checks the session and includes the authenticated user's ID in its query; authorization does not depend solely on a layout or browser redirect.
- Prisma 7 models and an initial PostgreSQL migration for users, billing analyses, and shared authentication attempt limits.
- Clear empty, pending, error, and not-found states; labeled forms; visible keyboard focus; reduced-motion support.

Phase 1 authentication and account behavior are preserved. Phase 2 extends the existing dashboard and analysis records below.

## Phase 2: documentation and MDM education

**Portfolio demonstration only. Synthetic clinical data only. Not intended for patient care or actual billing decisions.**

- `/dashboard/new`: Admission H&P or Progress Note, with a default full-note input and collapsible optional sections. Draft text survives switching workflows/modes while the form is mounted; only active fields are submitted. Drafts are not written to browser storage.
- Encounter family is an explicit user-confirmed assumption. Initial/subsequent hospital inpatient/observation families only; the title does not establish eligibility. No time-based billing.
- `/api/analyses` POST: requires a valid signed-in account, same-origin JSON, bounded/validated input, synthetic-data confirmation, and a shared per-account rate limit (10 live analyses or 20 prepared examples per 15 minutes). The server derives ownership from the session, never from client input.
- Live extraction uses the OpenAI Responses REST API with strict JSON Schema, Zod validation, `store: false`, a 40-second provider timeout, and no tools. No new SDK package is required. Neither note contents nor raw provider/database exceptions are logged.
- Every extracted finding has exact source excerpts or an explicit uncertainty flag. Unmatched excerpts cannot earn definite rule credit. AI categories are interpretations; substring validation does not independently validate clinical meaning.
- Optional Admission HPI wording is generated separately from coding. Its original source, suggestion, sentence evidence, and clarification questions are displayed. Conservative guards withhold suggestions containing new/lost substantive vocabulary, changed numbers/negation counts, or unmatched source quotes. This is not semantic validation; every suggestion still requires review. Nothing automatically overwrites the note or increases its coding level.
- Saved results distinguish source facts, clinical interpretations, deterministic rule conclusions, and uncertainty. Expandable diagnostic details cover labs, cardiac studies, imaging, other studies, external records, historians, and discussions.
- `/dashboard/history` paginates only the signed-in user's records. Saved details and `/api/analyses/[id]` enforce the same ownership boundary. Earlier Phase 1 records remain readable without inventing Phase 2 results.
- Twelve fictional cases include six core lower/moderate/high examples and six worksheet practice cases. **Run prepared example** uses an explicitly labeled fixture with independently specified expected outcomes, tested through the rules engine. It does not call OpenAI. Edited notes cannot silently use prepared fixtures.

The six core examples were rewritten after reviewing all 13 pages of `Scan 2021-9-8 02.15.09 (1).pdf` and all 14 pages of `Scan 2021-9-8 02.26.28 (1).pdf`. These supplied E/M University sheets and handwritten annotations use historical 1995/1997 documentation and problem/data-point methods, with examples dated 2008–2010. They are topic references, not the governing rules or treatment protocols. The application contains original fictional scenarios, not reproduced scan text, dollar amounts, or historical scoring tables. Raw scans remain local and ignored by Git.

| Core scenario | Problems / data / risk | Initial / subsequent potential CPT |
| --- | --- | --- |
| Improving uncomplicated gastroenteritis, reassessment of oral tolerance, supportive decisions | Low / Straightforward / Low | 99221 / 99231 |
| Nonsevere COPD exacerbation with treatment decisions and active hypertension/diabetes review | Moderate / Moderate / Moderate | 99222 / 99232 |
| Decompensated systolic heart failure with a documented respiratory organ threat and actual admission/escalation decision | High / Moderate / High | 99223 / 99233 |

Admission examples include a reason for evaluation, symptom timeline, relevant obtained ROS and history, examination, and explicit plan. Progress examples instead describe today's reason for review, attributed overnight nursing observations, patient symptoms, changes since the prior day, and decisions based on reassessment. Diagnostic results are separated from documented review activities; a listed EKG receives no activity credit. Lab panels count once. The moderate progress case specifically teaches that improvement and IV-to-oral transition do not automatically lower MDM. High risk is supported by an actual admission/escalation decision, not IV diuretics or routine response monitoring. All outcomes assume the selected hospital family and exclude a distinct critical-care or discharge service. These are coding-education fixtures, not clinical or billing validation or recommended patient treatment.

### Danger Table Worksheet incorporation

The locally supplied `Danger Table Worksheet (1).pdf` was visually reviewed. Its diagnosis/data point totals and combined legacy risk table are not used for present-day hospital code selection. The application incorporates the teaching topics through original fictional cases, an expandable guide on the New Analysis/results pages, and extraction instructions that keep problems, data, and current management decisions distinct.

The six added cases cover two stable conditions with two panel reviews, a nonsevere asthma flare, routine response monitoring, documented intensive heparin toxicity monitoring, historical DNR status, and a new prognosis-based care-limitation decision. Expected outcomes are individually specified and checked against the rule engine with exact source excerpts. The heparin example intentionally leaves aPTT data credit unresolved under the MVP's limited test catalog; two supported high elements still establish high overall MDM. The routine-monitoring and historical-DNR examples do not receive high risk from those labels alone.

The AMA's 2023 hospital MDM table and accompanying definitions govern these adaptations, including its distinction between efficacy checks and toxicity monitoring (printed pages 18–19) and the current management-decision criterion for resuscitation limitation. This is educational implementation review, not independent clinical/billing validation. The local reference scans are gitignored; the app does not redistribute their scanned tables.

### Live AI configuration

Add these server-only variables to your existing local `.env` and to the appropriate Vercel environment. Do not overwrite the working database/authentication settings.

```dotenv
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
OPENAI_MODEL="gpt-4.1-mini-2025-04-14"
```

The default model snapshot supports structured output. API access/billing is separate from a ChatGPT subscription. Never paste the key into chat, commit it, or prefix it with `NEXT_PUBLIC_`. Prepared examples remain functional without an API key. Restart the local development server after changing environment settings; redeploy Vercel after changing its variables.

Only wholly invented documentation is allowed. An explicit acknowledgement and best-effort checks for obvious identifiers precede any provider call. These checks cannot detect all real patient information and are not de-identification or HIPAA compliance. Do not submit real notes, even with names removed. `store: false` does not constitute a promise of zero provider retention.

### Coding rule version and scope

The engine is `src/lib/clinical/mdm.ts`, version `hospital-mdm-2023-public-v1`, reviewed October 27, 2026. Sources are the public [AMA hospital E/M guidelines effective January 2023](https://www.ama-assn.org/system/files/2023-e-m-descriptors-guidelines.pdf), [AMA clarifications updated January 2026](https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management-em-revisions-faqs), and [CMS MLN006764, May 2026](https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf). This is a conservative educational subset, not an exhaustive implementation or verification of the licensed 2026 CPT manual or individual payer requirements.

The model extracts clinical categories and physician activities; it has no final-code/overall-MDM fields. The engine evaluates the three elements and applies the two-of-three threshold. Straightforward/low map to 99221 or 99231, moderate to 99222 or 99232, and high to 99223 or 99233 under the confirmed encounter assumption. Scope conflicts or unresolved element ranges that change the overall level produce an indeterminate code.

Data credit is activity-based. Identity grouping prevents duplicated panel components, repeated results, order-plus-review double counting, and repeated external-source/historian credit. High data requires multiple qualifying categories, not simply more results. Independent interpretations/discussions require confirmed eligibility; separate-reporting uncertainty is retained. For conservative MVP uniqueness verification, definite diagnostic-test identities are limited to blood-count panels, overlapping metabolic panels, ECG, and chest radiographs. Other tests are displayed but left unresolved. This deliberate limitation can make an assessment indeterminate; the engine does not guess unfamiliar test identities.

Clinical problem severity/status and management criteria still depend on reviewing the original note and the extracted interpretation. Hospital location, medication lists, and abnormal values alone do not establish high management risk. HPI suggestions never enter the engine. Service eligibility, medical necessity, modifiers, critical care, consultations, discharge/same-day services, and payer edits require separate review and are outside this MVP.

### Phase 2 database migration

`20261027010000_phase_two` adds nullable columns to `BillingAnalysis`, preserving users and prior records. It stores encounter/input modes, the active submitted input, versioned structured extraction/rule results, per-element complexity, gaps, and optional HPI wording; original documentation, owner ID, code/explanation, and timestamps use the existing fields. Saved reports are snapshots and are not recomputed when viewed.

On a fresh database or a separate deployment database, apply all checked-in migrations:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
```

The existing MedCodeAI Neon database already received the additive Phase 2 migration and its checksum/history entry during implementation. The local managed environment blocks Prisma's schema-engine subprocess, so it was applied transactionally through the connected Neon service. Ordinary terminals and deployment automation should continue using `db:deploy`; do not rerun the raw SQL manually.

## Requirements and packages

Use Node.js 24 LTS and npm. Dependencies are declared in `package.json`: Next.js 16 / React 19, Tailwind 4, TypeScript, Auth.js (`next-auth` v5 beta, pinned), Prisma 7, `@prisma/adapter-pg`, `pg`, `bcryptjs`, Zod, Lucide icons, and `server-only`. Unit tests compile the actual TypeScript sources and run with Node's test runner in one process; typechecking is a separate required check.

Auth.js Credentials uses JWT sessions; it does not create users automatically. Registration explicitly persists the user through Prisma. An Auth.js database adapter and OAuth Account/Session tables are unnecessary for this flow.

## Local setup (PowerShell / VS Code terminal)

From this project directory:

```powershell
npm.cmd ci
# Fresh clones only: preserve an existing configured .env.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the generated value into `AUTH_SECRET` in `.env`, then configure the database connections below. Do not reuse the placeholder secret. `npm install` generates the Prisma client through `postinstall`; `npm run db:generate` can regenerate it explicitly. The dependency lockfile is included; use `npm ci` for reproducible installs.

Installation requires access to the npm registry. If running in a restricted environment, install from your regular, network-enabled terminal.

### Configure Neon

1. Create a Neon PostgreSQL project and a dedicated development database/branch in the [Neon console](https://console.neon.tech). Keep demo and deployment data separate if using multiple environments.
2. Open **Connect** for your database and database role. Copy the **pooled** PostgreSQL connection string to `DATABASE_URL`. Its hostname normally contains `-pooler`.
3. Turn connection pooling off in the connection dialog and copy the **direct** string to `DIRECT_URL`. Prisma CLI migrations use this URL; application requests use the pooled URL.
4. Preserve the SSL parameters supplied by Neon. If manually constructing a URL, percent-encode special characters in its password. Never paste credentials into chat or commit them.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@YOUR-ENDPOINT.REGION.aws.neon.tech/neondb?sslmode=require"
AUTH_SECRET="YOUR_GENERATED_RANDOM_SECRET"
AUTH_URL="http://localhost:3000"
```

Store these in the root `.env` file, which both Prisma and Next.js load. None uses the `NEXT_PUBLIC_` prefix. `.env` is gitignored. The fallback URL in `prisma.config.ts` only allows offline client generation; it is not a working database and is never used as a runtime fallback.

Apply all checked-in migrations, then launch:

```powershell
npm.cmd run db:deploy
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, then sign in. Registration redirects to login after success. Use `npm.cmd run db:migrate -- --name describe_change` to generate future development migrations. Use `db:deploy` to apply committed migrations to deployment databases; do not use `migrate dev` there. `npm.cmd run db:studio` opens the database browser locally; only store fictional clinical notes.

Database connections are environment-specific. A fresh clone needs its own local `.env`; credentials are never included in the repository. If Next.js selects port 3001 because port 3000 is occupied, change `AUTH_URL` to `http://localhost:3001` and use the Local address printed by the development server.

## Structure

```text
prisma/
  schema.prisma                  User, BillingAnalysis, AuthThrottle
  migrations/                    Initial and additive Phase 2 migrations
prisma.config.ts                 Direct URL for Prisma CLI
src/
  app/
    page.tsx                     Public landing page
    (auth)/login/                Login
    (auth)/register/             Registration
    api/auth/[...nextauth]/      Auth.js handlers
    api/analyses/                Authenticated creation and owner-scoped reads
    dashboard/new/               Two documentation workflows/input modes
    dashboard/history/           Paginated owner-only analysis history
    dashboard/                   Protected dashboard and analysis details
    actions.ts                   Registration, login, logout server actions
  auth.ts                        Credentials and JWT session callbacks
  components/                    Brand, forms, synthetic-data disclaimer
  lib/
    db.ts                        Server-only pooled Prisma client
    session.ts                   Authentication and existing-user check
    analyses.ts                  Owner-scoped data access
    owned-analysis.ts            Testable ownership boundary
    clinical/                    Input, schemas, extraction/HPI, rules, demos
    throttle.ts                  Shared PostgreSQL authentication limits
    validation.ts                Zod schemas
  types/next-auth.d.ts            Typed session user ID
tests/                           Auth, input, rules, provider, authorization tests
scripts/                         Unit-test runner and local HTTP/Neon smoke test
```

## Verification

After installation:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd exec prisma validate
npm.cmd run build
```

Unit tests cover email normalization, malformed input, required synthetic-data acknowledgement, required matching password confirmation, bcrypt's 72-byte limit (including multi-byte characters), and password hash verification. Typecheck and build generate Prisma first. No live database is needed to compile public pages; a configured database is needed for authentication and dashboard requests.

Manual acceptance checks after applying the migration:

1. Visit `/dashboard` while logged out; expect a redirect to `/login`.
2. Register with invalid email, fewer than 12 password characters, missing/mismatched password confirmation, or an unchecked acknowledgement; expect validation feedback. Repeat with valid input; expect the login page and success notice.
3. Try a duplicate email, a wrong password, and an unknown account; expect a generic error. Registration stores only `passwordHash`, never the submitted password.
4. Log in and verify the dashboard greeting and empty state. Refresh to verify the session. Sign out, then navigate directly to dashboard URLs; they must require login again.
5. Create two demo accounts. Save a prepared example as A. B must not see it in History; `/api/analyses/RECORD_ID` as B returns 404, and the details page renders a not-found view with no private note content. App Router may return an already-streamed 200 shell for a not-found page; the API retains a strict 404.
6. Make more than ten login attempts for the same normalized email within 15 minutes; expect rejection until the window expires. Registration allows five attempts per email per 15 minutes. Limits are shared across app instances.
7. Check narrow/mobile layouts and keyboard-only navigation. Test workflow/mode switching without losing drafts, optional HPI, empty input, both acknowledgements, prepared vs. edited examples, and provider error states. Use only entirely synthetic notes.

The test suite covers all twelve explicitly specified case expectations, all 64 definite MDM element combinations, uncertain/missing evidence, data deduplication, original HPI safeguards, strict provider output/refusal/error handling, input size/consent, worksheet adaptations, and ownership. Progress-note clarification tests also verify source-grounded questions, deduplication, and unchanged coding inputs and conclusions. `npm test` requires no database or paid provider calls.

Progress Note forms and results include a collapsible guide to the reason for today's review, attributed interval history, and explicit daily decisions. Live extraction considers the whole note before raising gaps and does not assume that improvement or unchanged treatment establishes a particular level. A separate educational helper adds conditional, source-grounded questions for common vague phrases such as "patient stable", "continue POC", and "per cardiology". These phrase prompts are not a completeness detector or coding rules: they only append clarification questions, never change clinical findings, completeness flags, MDM levels, or CPT codes. Existing saved reports retain their original questions; newly saved progress analyses receive the prompts. No schema migration or new environment variables are required.

For HTTP/database verification, run `npm test`, start the local app in another terminal, then run `npm run test:integration`. It uses `AUTH_URL` (or `MEDCODE_TEST_URL`) and must target localhost. It creates two temporary test accounts, saves all twelve prepared examples across both input modes, checks owner-only API/pages/history and anonymous/cross-origin rejection, then removes only its own accounts and records. It never invokes OpenAI. The test uses locally signed test sessions to exercise the real Auth.js session boundary; it does not replace testing the registration/login forms manually.

On managed Windows environments that block build subprocesses, use the opt-in worker-thread build path without disabling typechecking:

```powershell
npm.cmd run build:managed
```

This opt-in path uses `.next-managed` output to avoid OneDrive locks or collisions with a running dev server. Vercel and normal developer terminals use the default `npm run build`. Live model quality, refusal behavior for arbitrary real-world inputs, and clinical/coding validity are not established by fixture or mocked transport tests.

## Publishing to GitHub

Initialize the project in VS Code's Source Control panel, review the files, and use **Publish to GitHub**. A private repository is a useful default while the demo is in development.

Commit source files, Prisma migrations, `package.json`, `package-lock.json`, and `.env.example`. The `.gitignore` excludes `.env`, `node_modules`, generated Prisma files, build output, and local tooling caches. Keep real database URLs and authentication secrets out of commits, screenshots, and issue reports. Publishing the code to GitHub does not deploy the application; deployment is a separate step.

## Vercel deployment preparation

Import this project into Vercel as a Next.js application after pushing it to your repository. Use Node.js 24, the standard install command, and `npm run build`. Set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET` as server environment variables. Add `OPENAI_API_KEY` and `OPENAI_MODEL` for live analysis. Auth.js v5 infers the Vercel host, so `AUTH_URL` can remain unset there; never copy a localhost URL into Vercel. Use a different secret/database branch for unrelated environments.

Apply all migrations using `npm run db:deploy` against the target database before testing. The default build intentionally does not migrate databases. Auth.js recognizes Vercel's host environment; only enable `AUTH_TRUST_HOST=true` on other hosts when the host/proxy is trusted. Never disable secure cookies for an HTTPS deployment. Redeploy after saving environment variables, then test the newly deployed URL.

This phase does not deploy or publish the app. Email verification, password recovery, account deletion, MFA, and distributed IP-based abuse protection are outside Phase 1. The per-email throttle is useful for a demo but does not prevent attacks spread across many email addresses. Old throttle keys may be periodically removed from the database. Disabling an account requires deleting it; rotating `AUTH_SECRET` invalidates all JWT sessions. Logout clears the browser session but is not centralized token revocation.

## Reference documentation

- [Next.js authentication and data access guidance](https://nextjs.org/docs/app/guides/authentication)
- [Auth.js Credentials provider](https://authjs.dev/getting-started/authentication/credentials)
- [Prisma PostgreSQL configuration and pooled/direct connections](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Configured default model and supported output formats](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
