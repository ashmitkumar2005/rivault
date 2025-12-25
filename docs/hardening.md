# Rivault Hardening & Reliability

This document defines the failure behavior, consistency models, and reliability guarantees of the Rivault storage system. It serves as the reference for how the system handles crashes, outages, and partial operations.

## 1. Failure Scenarios

### 1.1 Process Crash During File Upload (Mid-Chunk)
- **Scenario**: The server process terminates while uploading chunks to Telegram.
- **State Impact**: Some chunks exist in Telegram. No metadata exists in FS Engine or Persistence.
- **Result**: **Safe**. The file is effectively "never created".
- **Side Effect**: Orphaned data (chunks) remain in Telegram storage.
- **Recovery**: Automated garbage collection (GC) required to reclaim storage space.

### 1.2 Process Crash After Upload / Before Metadata Persistence
- **Scenario**: All chunks upload successfully, `fsEngine.createFile` updates in-memory state, but the process crashes before `gistAdapter.saveState` completes.
- **State Impact**: In-memory state is lost. Persistence (Gist) remains at the previous snapshot.
- **Result**: **Safe (Rollback)**. On restart, the system reloads the last persisted state. The new file is missing.
- **Side Effect**: Orphaned data (full file chunks) remain in Telegram storage.
- **Recovery**: User must retry upload. Automated GC required for orphans.

### 1.3 Process Crash During Metadata-Only Operations (Rename/Move)
- **Scenario**: `fsEngine` updates in-memory state, but process crashes during `gistAdapter.saveState`.
- **State Impact**: In-memory changes lost. Persistence remains at previous snapshot.
- **Result**: **Safe (Atomic Rollback)**. The operation essentially "didn't happen".
- **Recovery**: User must retry the operation.

### 1.4 Persistence Layer Failure (GitHub Gist Unavailable)
- **Scenario**: Gist API returns 500/503 during `initService` or `saveState`.
- **Read Impact**: If during init, system fails to start (Fast-fail).
- **Write Impact**: `saveState` throws exception. In-memory state diverges from persisted state.
- **Handling**: The current implementation throws errors on save.
- **Risk**: If the process crashes after a failed save, data loss (metadata revert) occurs.

### 1.5 Storage Layer Failure (Telegram Unavailable)
- **Scenario**: Telegram API fails during Upload/Download.
- **Upload**: Operation fails immediately. No metadata created. Safe.
- **Download**: Read operation fails. Metadata remains intact. Safe.
- **Delete**: "Best-effort" deletion fails. Metadata is removed, but chunks remain.
- **Result**: Orphaned chunks (on delete failure). No corruption.

## 2. Atomicity & Ordering Guarantees

Rivault enforces a strict **Storage-First, Metadata-Second, Persistence-Last** write model to prevent corruption.

### 2.1 The "Commit Point"
The transaction is considered **committed** only when `gistAdapter.saveState()` returns successfully.
- **Pre-Commit**: Storage chunks uploaded. (Reversible via GC)
- **In-Memory Commit**: FS Engine updated. (Volatile)
- **Durable Commit**: Gist updated. (Final)

### 2.2 Why Partial Storage Writes Are Acceptable
Storage backend (Telegram) acts as a **Content Addressable Store (CAS)**. Writing data there does not alter the filesystem view. A file "exists" only if the Metadata (Gist) points to those storage references. Therefore, partial uploads are invisible to the user and harmless to integrity.

### 2.3 Partial Metadata Protection
The FS Engine is strictly in-memory. It does not expose partial states to Persistence. `saveState` serializes the *entire* valid state at once. This guarantees that the persisted image is always structurally valid (no partial writes to JSON).

## 3. Idempotency Rules

### 3.1 uploadFile
- **Not Idempotent**.
- **Retry Behavior**: If retried with the same name, `fsEngine` throws `NameConflictError`.
- **Correction**: Client should either rename the file or delete the partial/conflict target before retrying.

### 3.2 deleteNode
- **Idempotent**.
- **Retry Behavior**: If node is already gone, `fsEngine` (or service wrapper) should handle `NotFoundError` gracefully or consider it a success state ("Target is ensuring x is gone").
- **Current Imp**: Throws `NotFoundError` if missing. Clients can treat 404 on Delete as Success.

### 3.3 renameNode / moveNode
- **Not Idempotent**.
- **Retry Behavior**:
  - `rename(A -> B)`: Second call fails (A not found) or fails (B already exists).
  - `move(A -> B)`: Second call fails (A already in B, potentially) or essentially no-op if logic checks parent.
- **Handling**: Clients must query state if an operation times out to verify application.

## 4. Read-Only & Degraded Modes (Design Only)

### 4.1 Persistence Unavailable (Degraded Write)
If Gist is reachable for Reads but fails Writes (e.g., quota exceeded):
- **Behavior**: Switch system to **Read-Only Mode**.
- **Action**: All `POST`, `PATCH`, `DELETE` operations return HTTP 503.
- **Reads**: `GET /folders` continues to serve from in-memory cache.

### 4.2 Storage Unavailable (Degraded Data)
If Telegram is down:
- **Behavior**: **Metadata Navigation Mode**.
- **Action**: `GET /folders` works. `GET /files/:id` returns HTTP 503.
- **Writes**: Uploads fail. Metadata-only ops (Rename/Move) remain functional.

### 4.3 Total Outage
- **Action**: System fails to start or returns HTTP 503 on all routes.

## 5. Orphan Data & Garbage Collection (Design Only)

### 5.1 Definition
**Orphaned Chunk**: A message/document in the Telegram Chat that is NOT referenced by any `chunkRef` in the current persisted Gist JSON.

### 5.2 Source of Orphans
1. Failed uploads (partial chunks).
2. Failed deletes (metadata removed, storage delete call failed).
3. "Rollback" crashes (uploaded -> crash -> metadata reverted).

### 5.3 Cleanup Strategy (Async GC)
A separate process or scheduled task should:
1. Load the current Gist/FSState.
2. Build a Set of all valid `storageReference`s.
3. Iterate through Telegram Chat history (if API allows) or maintain a separate "Write Log".
4. Delete any message (Chunk) not in the Valid Set.
5. **Safety**: GC must run only when no active uploads are in progress (or enforce a time delay, e.g., delete only orphans > 24 hours old).

## 6. Non-Goals & Explicit Trade-offs

### 6.1 No Multi-User Concurrency
Rivault uses a "Last Write Wins" persistence model. If two server instances run simultaneously, they will overwrite each other's Gist updates.
- **Justification**: Rivault is designed as a **Single-User Personal Cloud**. Distributed locking adds unnecessary complexity.

### 6.2 Zero-Orphan Guarantee
Rivault prioritizes **Metadata Integrity** over Storage Efficiency. It is acceptable to waste storage space (orphans) to ensure no user data is ever corrupted or partially linked.
- **Justification**: Storage (Telegram) is "unlimited/free"; Engineering time and Complexity are expensive.

### 6.3 Real-Time crash recovery
Rebooting the server reverts to the last checkpoint. There is no Write-Ahead Log (WAL) to replay in-memory changes lost before Gist sync.
- **Justification**: Simplicity. Gist latency makes fine-grained WAL difficult. Checkpointing per operation is sufficient for personal use.
