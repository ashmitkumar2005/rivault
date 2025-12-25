# Rivault

Rivault is a private, crash-safe cloud storage system that provides a personal filesystem interface over arbitrary storage backends. By decoupling metadata management from binary storage, it offers rigorous privacy guarantees and architectural flexibility, allowing users to turn commodity platforms (like Telegram) into secure, infinite storage drives.

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

## How to Run (High-Level)

1.  **Configure Secrets**: Set up your crypto keys and provider tokens in `.env`.
2.  **Start Backend**: Launch the orchestration server (`server.ts`).
3.  **Interact**: Use the CLI tool (`rivault`) or the HTTP API to manage your drive.

The system will automatically bootstrap a new filesystem state if none is found.
