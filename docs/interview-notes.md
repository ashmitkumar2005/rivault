# Interview Notes for Rivault

## 1. 2–3 Minute Project Explanation

"Rivault is a private, zero-trust cloud storage system I engineered to turn arbitrary storage backends into a secure personal drive.

The core problem with using platforms like Telegram or S3 directly is the lack of filesystem semantics and privacy. Rivault solves this by decoupling **Metadata** (the folder structure) from **Storage** (the binary blobs).

I built a layered architecture in Node.js where an in-memory orchestration layer manages this state. It enforces a strict **'Storage-First' write consistency model**, ensuring that if a process crashes mid-upload, we might waste storage space, but we never corrupt the user's file index.

Security was a major focus. I implemented **Envelope Encryption** using AES-256-GCM. Each file gets a unique random key, which is then wrapped by a master key. This ensures that even if the storage provider is compromised, they see only high-entropy noise. The system is fully operational with a CLI client and withstands arbitrary process kills without data loss."

## 2. Key Design Decisions

### **Metadata vs. Storage Separation**
*   **Decision**: Store the directory tree as a single JSON object in a Gist, separate from the binary data in Telegram.
*   **Why**: This allows instant directory listing and moving entire subtrees in O(1) time (just changing a pointer in memory) vs O(N) API calls on standard object stores. It also allows us to switch storage providers without migrating metadata.

### **Ordering Guarantees (Crash Safety)**
*   **Decision**: Upload Chunks -> Commit to Memory -> Persist State.
*   **Why**: If we committed to memory first, a crash would leave us with a file entry pointing to non-existent data (Corruption). By uploading first, a crash results only in an orphaned blob (Cleaner, solvable via Garbage Collection).

### **Envelope Encryption Placement**
*   **Decision**: Encrypt on the server (Orchestrator) before the data touches the adapter.
*   **Why**: This enforces a "Zero Trust" boundry. The storage adapter interface receives only `Buffer` (ciphertext). It is mathematically impossible for the adapter implementation to accidentally log or leak plaintext.

## 3. Common Interview Questions & Answers

**Q: Why choose Telegram/Gist?**
*   **A**: They represent the extreme end of "unreliable" or "constrained" providers. Engineering a robust system on top of them proves the architecture can handle any standard provider (S3/Postgres) easily. It enforces strict decoupling.

**Q: How is crash safety guaranteed?**
*   **A**: Through the write-order protocol. State is only persisted to the Gist *after* the storage upload is confirmed successful. Since the Gist write is atomic (a single HTTP PUT), the system transitions from "Old State" to "New State" instantly. There is no intermediate "half-written" metadata state.

**Q: What would you change for multi-user support?**
*   **A**: The current "Snapshot State" model fails with concurrent writers (Last Write Wins). For multi-user, I would move the metadata to a transactional database (Postgres) and implement **row-level locking** or use an **Event Sourcing** model where the state is a reduction of signed operation events.

**Q: How do you handle large files?**
*   **A**: Files are streamed and chunked (20MB default). Accessing a specific byte range only requires downloading the relevant chunk, not the whole file. This allows seeking in videos or partial downloads.
