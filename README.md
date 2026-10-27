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

No clinical text submission, AI calls, or OpenAI dependencies are implemented. The landing-page workspace is explicitly an illustrative Phase 2 preview. The dashboard does not invent analyses or clinical results.

## Requirements and packages

Use Node.js 24 LTS (Node 22.12+ also meets Prisma 7 requirements) and npm. Dependencies are declared in `package.json`: Next.js 16 / React 19, Tailwind 4, TypeScript, Auth.js (`next-auth` v5 beta, pinned), Prisma 7, `@prisma/adapter-pg`, `pg`, `bcryptjs`, Zod, Lucide icons, and `server-only`. Development tools include ESLint and `tsx` for Node tests.

Auth.js Credentials uses JWT sessions; it does not create users automatically. Registration explicitly persists the user through Prisma. An Auth.js database adapter and OAuth Account/Session tables are unnecessary for this flow.

## Local setup (PowerShell / VS Code terminal)

From this project directory:

```powershell
npm.cmd install
Copy-Item .env.example .env
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

Apply the checked-in initial migration, then launch:

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
  migrations/                    Initial PostgreSQL migration
prisma.config.ts                 Direct URL for Prisma CLI
src/
  app/
    page.tsx                     Public landing page
    (auth)/login/                Login
    (auth)/register/             Registration
    api/auth/[...nextauth]/      Auth.js handlers
    dashboard/                   Protected dashboard and analysis details
    actions.ts                   Registration, login, logout server actions
  auth.ts                        Credentials and JWT session callbacks
  components/                    Brand, forms, synthetic-data disclaimer
  lib/
    db.ts                        Server-only pooled Prisma client
    session.ts                   Authentication and existing-user check
    analyses.ts                  Owner-scoped data access
    throttle.ts                  Shared PostgreSQL authentication limits
    validation.ts                Zod schemas
  types/next-auth.d.ts            Typed session user ID
tests/validation.test.ts          Validation and password hashing tests
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
5. Create two demo accounts. If testing saved records, use Prisma Studio to add a strictly fictional analysis owned by account A (set `syntheticDataConfirmed` to true). Account B must not see it in its list, and visiting `/dashboard/analyses/RECORD_ID` as B must return a not-found page. There is intentionally no analysis creation endpoint in Phase 1.
6. Make more than ten login attempts for the same normalized email within 15 minutes; expect rejection until the window expires. Registration allows five attempts per email per 15 minutes. Limits are shared across app instances.
7. Check narrow/mobile layouts and keyboard-only navigation. No form should accept clinical notes in Phase 1.

Latest verification: TypeScript checks and lint for the changed application files passed. All six validation/password tests passed after compiling the test sources and running Node's test runner without subprocess isolation, because the environment blocked subprocess creation by the default test runner. An HTTP registration check confirmed account creation, password hash verification, and the redirect to login before password confirmation was added; confirmation is covered by the validation tests. The homepage was checked for both navigation anchors and their corresponding sections. A production build and the remaining manual acceptance checks still need to be completed.

## Publishing to GitHub

Initialize the project in VS Code's Source Control panel, review the files, and use **Publish to GitHub**. A private repository is a useful default while the demo is in development.

Commit source files, Prisma migrations, `package.json`, `package-lock.json`, and `.env.example`. The `.gitignore` excludes `.env`, `node_modules`, generated Prisma files, build output, and local tooling caches. Keep real database URLs and authentication secrets out of commits, screenshots, and issue reports. Publishing the code to GitHub does not deploy the application; deployment is a separate step.

## Vercel deployment preparation

Import this project into Vercel as a Next.js application after pushing it to your repository. Use Node.js 24, the standard install command, and `npm run build`. Set `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, and `AUTH_URL` as server environment variables; set `AUTH_URL` to the canonical HTTPS deployment URL. Use a different secret/database branch for unrelated environments. Configure preview environments deliberately so their authentication URLs match their deployment.

Apply the initial migration using `npm run db:deploy` against the target database before testing registration. The default build intentionally does not migrate databases. Auth.js recognizes Vercel's host environment; only enable `AUTH_TRUST_HOST=true` on other hosts when the host/proxy is trusted. Never disable secure cookies for an HTTPS deployment.

This phase does not deploy or publish the app. Email verification, password recovery, account deletion, MFA, and distributed IP-based abuse protection are outside Phase 1. The per-email throttle is useful for a demo but does not prevent attacks spread across many email addresses. Old throttle keys may be periodically removed from the database. Disabling an account requires deleting it; rotating `AUTH_SECRET` invalidates all JWT sessions. Logout clears the browser session but is not centralized token revocation.

## Reference documentation

- [Next.js authentication and data access guidance](https://nextjs.org/docs/app/guides/authentication)
- [Auth.js Credentials provider](https://authjs.dev/getting-started/authentication/credentials)
- [Prisma PostgreSQL configuration and pooled/direct connections](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
