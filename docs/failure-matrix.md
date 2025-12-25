# Failure Scenario Matrix

This document outlines the system's behavior under various failure conditions, defining the impact on data integrity and the required recovery actions.

| Failure Scenario | Layer | Impact | System State | Recovery |
| :--- | :--- | :--- | :--- | :--- |
| **Crash during file upload** | Service / Storage | High (Bandwidth) | **Consistent**. File metadata was never created. Uploaded chunks are orphaned in storage. | Retry upload. (Optional background GC for orphan chunks). |
| **Crash after upload, before persistence** | Service / Persistence | Medium | **Consistent (Rollback)**. In-memory state is lost. On restart, system loads last valid snapshot (pre-upload). | Retry upload. |
| **Storage Provider Unavailable** | Adapter | High (Availability) | **Frozen**. Read/Write operations fail. Metadata remains navigable (read-only state). | Retry later. |
| **Persistence Provider Unavailable** | Adapter | Critical | **Volatile**. System can operate in-memory but cannot save. Restart leads to data loss of recent changes. | Repair connection or switch persistence backend. |
| **Wrong Master Password** | Crypto | Critical | ** inaccessible**. System cannot decrypt Data Keys. Files cannot be downloaded. | Restart with correct password. |
| **Metadata Corruption (Remote)** | Persistence | Critical | **Failed Boot**. JSON parse error on load. | Restore from previous Gist revision (if available) or forced reset. |
| **Chunk Deletion Failure** | Storage | Low | **Consistent**. Metadata deleted, but binary data remains on remote storage. | Ignore (wasted remote space). |
| **Renaming non-existent node** | Engine | Low | **Error**. Operation rejected by invariant check. | User error. Correct input. |

## Key Reliability Guarantees

1.  **Atomicity**: File creation is "all-or-nothing". You never see a file that is half-uploaded or missing chunks.
2.  **Idempotency**: Moving a file to the same location multiple times yields the same result (success or no-op).
3.  **Isolation**: Reading a file while it is being moved results in either the old path or the new path, never a "not found" (assuming atomic pointer swap). *Note: In this implementation, operations are serial via the API loop.*
