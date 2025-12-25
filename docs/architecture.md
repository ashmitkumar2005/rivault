# Rivault Architecture

## 1. Problem Statement

Traditional cloud storage solutions often tightly couple metadata management with blob storage, resulting in systems that are difficult to customize, hard to audit, and reliant on proprietary backends. Furthermore, most "drive" implementations are merely synchronization clients for a remote API, lacking true local filesystem semantics or robust crash safety guarantees at the protocol level.

Rivault was designed to solve the problem of creating a specialized, personal storage system that maintains rigorous trust boundaries. It decouples the "what" (metadata) from the "where" (storage) and the "how" (persistence), ensuring that a failure in one layer does not catastrophically corrupt the entire system.

## 2. High-Level Architecture

Rivault employs a strict layered architecture where dependencies flow downwards. Lower layers are unaware of the context provided by upper layers.

1.  **Interface Layer (CLI / HTTP API)**:
    *   Acts as the entry point for user interaction.
    *   Thin wrappers that translate external inputs (args, HTTP requests) into internal domain commands.
    *   Stateless and focused solely on transport.

2.  **Service Layer (Orchestration)**:
    *   The core "brain" of the system.
    *   Coordinates operations between the Engine, Storage, and Persistence layers.
    *   enforces operation atomicity and ordering (Start -> Encrypt -> Upload -> Commit Metadata -> Persist).
    *   Manages encryption keys and cryptographic operations.

3.  **Filesystem Engine (Core)**:
    *   Pure, in-memory domain model.
    *   Enforces filesystem invariants (e.g., "cannot move folder into itself", "names must be unique in parent").
    *   Metadata manipulation only; strictly ignorant of where bytes are stored.

4.  **Persistence Layer**:
    *   Responsible for serializing the filesystem state (metadata) to durable storage (GitHub Gist).
    *   Provides atomic "save" and "load" operations.

5.  **Storage Adapter**:
    *   Responsible for the raw I/O of binary data (Telegram).
    *   Treats all data as opaque, encrypted blobs.
    *   No knowledge of filenames, hierarchy, or types.

## 3. Filesystem Design

Rivault mimics a traditional POSIX-like filesystem but optimizes for cloud constraints:

*   **Tree-Based Namespace**: Folders and files are organized in a strict hierarchy rooted at a fixed `rootId`.
*   **Immutable IDs**: Every node (file or folder) is assigned a globally unique, immutable ID (NanoID) upon creation.
*   **Derived Paths**: File paths are not stored. They are computed dynamically by traversing parent pointers up to the root. This makes "move" operations O(1) simply by changing a `parentId`.
*   **Metadata-Only Rename/Move**: Renaming or moving a file or folder is a pure metadata operation. No storage blobs are moved or modified, ensuring high performance even for massive directory trees.

## 4. Persistence Model

The system prioritizes **Metadata Consistency**.

*   **Source of Truth**: The in-memory FSState (`map<ID, Node>`) is the single source of truth.
*   **Atomic Persistence**: The entire state tree is serialized to JSON and persisted transactionally.
*   **Storage-First Commit**: The system enforces a "Storage-First" write policy. Binary data is uploaded and confirmed *before* the metadata is added to the in-memory tree.
*   **Crash Recovery**:
    *   If the process crashes **during** upload: Storage blobs are orphaned (wasted space) but the filesystem remains consistent.
    *   If the process crashes **during** persistence: The previous valid snapshot remains in the persistence backend.

## 5. Storage Model

Storage is treated as an append-only, content-addressable blob store.

*   **Blob-Based**: Files are effectively pointers to a list of remote blob references.
*   **Chunking**: Large files are split into fixed-size chunks (default 20MB) to fit within backend limits (e.g., Telegram file size limits).
*   **Ordering**: The `File` metadata maintains an ordered list of these chunks (`{ order: 0, ref: "xyz" }`), ensuring the file is reconstructed correctly on download.

## 6. Security Model

Rivault implements a **Zero-Trust Backend** model. It assumes the storage provider (Telegram) and persistence provider (GitHub) are untrusted or could be compromised.

*   **Envelope Encryption**:
    *   **Master Key**: Derived from a user password using PBKDF2. Never stored.
    *   **Data Key**: A unique, random AES-256 key generated for *every* file.
    *   **Key Wrapping**: The Data Key is encrypted (wrapped) using the Master Key.
*   **Encryption at Rest**:
    *   File content is encrypted with the Data Key (AES-256-GCM) before upload.
    *   Only the *ciphertext* leaves the server.
    *   The *wrapped* Data Key is stored in the file metadata.
*   **Key Isolation**: Compromising one file's key does not compromise others. compromising the persistence layer (metadata) reveals structure but no content.

## 7. Trade-offs & Non-Goals

*   **No Multi-User Support**: The system is designed for a single owner. Concurrent modification by multiple users would require complex locking or CRDTs (Conflict-Free Replicated Data Types) which was out of scope.
*   **No Real-Time Sync**: Clients poll or request state; there are no WebSockets pushing updates. This simplifies the architecture significantly.
*   **No Deduplication**: Identical files are uploaded twice. Deduplication requires content-hashing and global indexing, which introduces privacy concerns (leakage via hash correlation) and complexity.
