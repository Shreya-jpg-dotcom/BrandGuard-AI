# BrandGuard AI — Final integrated project (Parts 1–5)

BrandGuard AI is a React/Vite + Express/Mongoose brand-governance application. This archive continues the Part 4 codebase; it does not replace the existing architecture. It includes employee and administrator access, document ingestion and deterministic/optional AI analysis, organisation knowledge records, document-scoped chat, exact-span corrections, version history, human review, audit events and organisation insights.

> **Deployment status:** this is a locally packaged project, not a deployed service. The frontend production build, MongoDB-backed workflows and live provider calls still need to be run in an environment with dependencies and credentials. See `FINAL_ENGINEERING_REPORT.md` for the verification matrix and limitations.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- MongoDB Atlas or a compatible MongoDB deployment
- Optional: OpenAI or Gemini API key for provider-backed analysis/chat

## 1. Install

Extract the ZIP, open a terminal in the `BrandGuard-AI` folder, then run:

```bash
npm install
```

The root project uses npm workspaces for `client` and `server`.

## 2. Configure the backend

Copy `server/.env.example` to `server/.env` and set:

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://<db-user>:<db-password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<random-secret-at-least-32-characters>
JWT_EXPIRES_IN=1d
EMPLOYEE_REGISTRATION_ENABLED=true
DEFAULT_ORG_NAME=BrandGuard Workspace
PRIVATE_STORAGE_DIR=./private_uploads
```

For MongoDB Atlas:

1. Create an Atlas project and cluster.
2. Create a database user with a strong password. This is separate from your Atlas website login.
3. In Network Access, allow the IP address of the machine/server that will connect. Avoid `0.0.0.0/0` for a production database unless you have a deliberate network-security reason.
4. Copy the **Drivers** connection string, replace the username, password and database placeholders, and place it in `MONGODB_URI`.
5. URL-encode special characters in the database password before inserting it into the connection string.

The application creates/attaches its default organisation when the database connection starts. The current data model is single-organisation-per-user, with organisation scoping on application queries.

## 3. Provision the first Admin securely

Admin is not selectable during public registration. Create the initial Admin through the one-time provisioning script:

1. Temporarily add `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` to `server/.env`.
2. Use a unique password of at least 14 characters containing uppercase, lowercase, a number and a symbol.
3. From the project root run:

```bash
npm run provision-admin -w server
```

4. Remove the three `ADMIN_*` values from `server/.env` after provisioning.
5. Sign in through the Admin sign-in path.

The provisioning script refuses to create a second initial Admin for the same default organisation. Admins can create employee invitation links from Employee Management. If public employee registration should be disabled, set `EMPLOYEE_REGISTRATION_ENABLED=false`; invitation acceptance remains available.

## 4. Optional AI provider configuration

AI provider keys must remain in `server/.env`; never put them in `client/.env` or source code.

For OpenAI:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=<server-side-key>
OPENAI_MODEL=gpt-4o-mini
```

For Gemini:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side-key>
GEMINI_MODEL=gemini-2.0-flash
```

Set only the provider you intend to use. If the provider is not configured or fails, document analysis uses deterministic checks and chat uses a labelled deterministic-context fallback. A fallback response is not an AI-generated answer. Provider/model metadata is stored with analysis/chat results.

## 5. Configure and start locally

`client/.env.example` contains the local API URL. Copy it to `client/.env` if you want an explicit value:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

From the project root:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:5000/api/health`

You can also run the workspaces separately with `npm run dev:server` and `npm run dev:client`.

## 6. Tests and build

From the project root:

```bash
npm run check
```

This runs backend syntax checks, backend Node tests and the Vite production build. Or run individual commands:

```bash
npm run check -w server
npm test -w server
npm run build -w client
```

## 7. Production deployment

The repository does not deploy itself. Deploy the frontend and backend to your chosen hosting providers after the build and runtime checks pass.

1. Set `NODE_ENV=production`, `PORT`, `MONGODB_URI`, a new strong `JWT_SECRET`, `CLIENT_ORIGIN`, `PRIVATE_STORAGE_DIR`, and optional AI provider values in the backend hosting environment.
2. Use persistent private storage for `PRIVATE_STORAGE_DIR`. Uploaded files are not stored in MongoDB and will be lost if the host's filesystem is ephemeral. For multi-instance deployments, replace local disk storage with a private object-storage adapter before scaling horizontally.
3. Set frontend build variable `VITE_API_URL` to the deployed API base URL ending in `/api`. If frontend and backend are served under one origin, `/api` is the production fallback.
4. Configure the backend CORS origin to the exact frontend origin. The current session cookie is HTTP-only, Secure in production and SameSite Strict. The recommended deployment is same-site (ideally same-origin behind a reverse proxy). A frontend and API on unrelated sites require a deliberate cookie/CORS change and security review; do not simply disable cookie protections.
5. Build the frontend with `npm run build -w client` and serve the generated `client/dist` directory through a static host or web server.
6. Start the backend with `npm start -w server`. Ensure the process manager restarts it and that `/api/health` is monitored.
7. Provision the first Admin through a secure one-time deployment operation. Do not commit `.env` files or pass secrets in client build variables.
8. Configure HTTPS/TLS at the hosting/reverse-proxy layer. This source code does not itself provision TLS certificates, database encryption, backups or a WAF.
9. Before launch, test login, invitation acceptance, upload/download, analysis, review decisions, private file access, and organisation isolation against the production database.

## Implemented workflow

1. Employee creates a document by upload or pasted content.
2. Supported uploads are PDF, DOCX, TXT, MD and HTML, up to 15 MB.
3. Deterministic checks run against active approved facts, active terminology and active Brand Bible sources. If a provider is configured, AI-assisted analysis can add evidence-validated findings.
4. The report stores document version, method/provider metadata, findings, coverage and scoring algorithm version.
5. The employee opens the document workspace, asks document-specific questions, and reviews correction suggestions.
6. Applying an exact-span suggestion creates a new version and invalidates the current analysis. Re-analysis is required.
7. The current analysed version can be submitted for human review. A stale in-review item is marked superseded when a newer version is submitted.
8. An Admin reviews, comments, requests changes or approves. Unresolved critical findings block ordinary approval; a reasoned override is available to Admin and recorded.
9. An Admin must manually mark an approved document as published. AI never approves or publishes.

## Important boundaries

- The current role model is **Employee** and **Admin**. Admin performs the review function. Separate Reviewer and Legal/Compliance roles, delegated permissions and role assignment are not implemented.
- The original uploaded PDF/DOCX binary is retained unchanged. Text corrections apply to the extracted-text working copy and version snapshots; rich-format round-trip export is not implemented.
- Review history and account/organisation settings pages remain placeholders. The new insights page reports stored metrics, but team-level grouping is unavailable because the User model has no team field.
- Governance insights are aggregated from current stored analyses, suggestions and reviews. They are not a substitute for a validated BI pipeline.
- Local disk uploads require persistent storage. No cloud object-storage integration is included.
- Audit events are append-only through the application API, not tamper-proof against direct database administrators.
