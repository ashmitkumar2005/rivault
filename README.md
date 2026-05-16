# Rivault

Rivault is a private, crash-safe cloud storage system that provides a personal filesystem interface over arbitrary storage backends. By decoupling metadata management from binary storage, it offers rigorous privacy guarantees and architectural flexibility, allowing users to turn commodity platforms (like Telegram) into secure, infinite storage drives.


<img width="1920" height="1080" alt="Screenshot_20251228_184154" src="https://github.com/user-attachments/assets/78b2ea86-cc89-4703-95c2-03320f5ce1de" />


<img width="1920" height="1080" alt="Screenshot_20251228_184205" src="https://github.com/user-attachments/assets/ac495789-b1e3-4002-9f6a-80716312f8cd" />



## Key Properties

*   **Crash-Safe Metadata**: Uses strict "Storage-First" write ordering to prevent filesystem corruption during failures.
*   **Zero-Trust Encryption**: Client-side AES-256-GCM envelope encryption ensures storage providers never see plaintext.
*   **Replaceable Backends**: Storage (currently Telegram) and Persistence (currently GitHub Gist) are adapters, easily swappable for S3, Postgres, or local disk.
*   **Filesystem Semantics**: Provides a familiar hierarchical interface (folders, files, move, rename) rather than a flat object store bucket.

## Architecture Summary

Rivault operates as a **Stateful Orchestrator**. It loads the entire filesystem tree into memory for speed and consistency, allowing instant searches and O(1) directory moves.
-   **Writes**: Data is encrypted and uploaded incrementally. Only after full storage confirmation is the filesystem tree updated and persisted.
-   **Reads**: The system retrieves the encrypted chunks referenced in the metadata, decrypts them on the fly, and streams the original file back to the user.

## What Rivault Is NOT

*   **Not a Sync Client**: It does not sync a local folder (like Dropbox). It is a distinct remote filesystem.
*   **Not Multi-User**: Designed for a single owner with total control.
*   **Not a Database**: Optimizes for file blobs, not structured query data.

## Why This Project Exists

Rivault was built to explore distributed system consistency and security engineering. The primary engineering challenge was ensuring data integrity across unreliable distributed components without using heavy consensus algorithms (like Raft/Paxos), achieved instead through strict operation ordering and distinct trust boundaries.

## Local Development Setup

### Prerequisites

- Node.js (recommended 18+ or newer)
- npm
- Git

### Install Dependencies

From the repository root:

```bash
npm install
```

Then install backend dependencies:

```bash
cd backend && npm install
```

### Configure Environment

Create a local env file from the template:

```bash
cp .env.example .env
```

Open `.env` and update the values for your local environment.

### Start Development Server

Start the frontend from the repository root:

```bash
npm run dev
```

If you need the backend API locally, run:

```bash
cd backend
npm run build
npm start
```

Then set `NEXT_PUBLIC_API_URL` and `RIVAULT_API_URL` in `.env` to your backend URL, for example `http://localhost:3001`.

## Backend / Frontend Explanation

- **Frontend**: The main UI is built with Next.js and React and lives in the repository root.
- **Backend**: The API server is implemented in `backend/` using Fastify and TypeScript.
- **CLI**: The CLI entry point is `backend/cli/rivault.ts`.
- **Env config**: Runtime values are managed through `.env` and `.env.example`.

## Troubleshooting

- If `npm run dev` fails with `ENOENT` or missing `package.json`, ensure you are in the `rivault/` repository root.
- If API calls fail, verify `NEXT_PUBLIC_API_URL` and `RIVAULT_API_URL` are set correctly.
- If the backend is required, start it separately from `backend/`.
- If you see CORS or origin errors, set `ALLOWED_ORIGINS=http://localhost:3000`.
- If `npm install` reports vulnerabilities, run `npm audit` and review the recommendations.

## Development Notes

- The frontend uses **Next.js 16.1.1**, **React 19.2.3**, and **TypeScript**.
- The backend uses **Fastify** with TypeScript and loads `.env` values via `dotenv`.
- Use `npm run dev` for local frontend development and `npm run build && npm start` inside `backend/` for the API server.
- `.env.example` is committed to the repo as a template; do not commit your local `.env` file.

The system will automatically bootstrap a new filesystem state if none is found.
