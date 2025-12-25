\# Rivault Filesystem Contract

## 1. Overview
Rivault is a private, invite-only cloud storage system designed to emulate the behavior of a local filesystem (e.g., Windows Explorer, macOS Finder). It provides a familiar hierarchical interface for organizing data while abstracting the underlying storage mechanics.

**Guarantees:**
- **Atomic Semantics**: Filesystem metadata operations are defined to behave atomically from the user’s perspective.
- **Consistency**: The virtual filesystem tree remains structurally sound at all times.
- **Abstraction**: Users interact with logical Files and Folders, not storage chunks or backend identifiers.

---

## 2. Core Concepts

### Namespace
Rivault enforces a strict separation between naming and data. A file’s name and location are purely metadata properties and are fully decoupled from its content. Renaming or moving a file never involves modifying or relocating the underlying data.

### Hierarchy
The filesystem is organized as a directed acyclic graph (specifically, a tree) rooted at a single global Root Folder. Every node (File or Folder) must have exactly one parent, except for the Root.

### Identity vs. Location
- **Identity**: Every entity is uniquely identified by a persistent, immutable ID.
- **Location**: An entity’s location is defined by its `parent_id` and `name`, both of which may change over time.

---

## 3. Entities

### Folder
A container object that may hold other Files or Folders.
- `id` (UUID, Immutable): Unique identifier.
- `name` (String, Mutable): User-visible name. Must be unique among siblings.
- `parent_id` (UUID, Mutable): Reference to the containing Folder. Null only for Root.
- `created_at` (Timestamp, Immutable): Creation time.

### File
A leaf node representing a user data object.
- `id` (UUID, Immutable): Unique identifier.
- `name` (String, Mutable): User-visible name. Must be unique among siblings.
- `parent_id` (UUID, Mutable): Reference to the containing Folder.
- `size` (Integer, System-managed): Total size of the file in bytes.
- `mime_type` (String, System-derived): Data format identifier.
- `chunks` (List<ChunkRef>, Mutable): Ordered list of references to data chunks.
- `created_at` (Timestamp, Immutable): Creation time.

### Chunk
An abstract unit of stored data.
- `order` (Integer): Sequence number of the chunk within the file.
- `storage_reference` (Opaque String): Backend-agnostic pointer to the actual data blob.

---

## 4. Invariants (Non-Negotiable Rules)

1. **Identity Immutability**: An entity’s `id` never changes during its lifetime.
2. **Unique Sibling Names**: No two entities may share the same `name` within the same `parent_id`.
3. **Single Parent**: Every entity (except Root) must have exactly one valid `parent_id`.
4. **No Cycles**: A Folder may never be an ancestor or descendant of itself.
5. **Referential Integrity**: Every `parent_id` must reference an existing Folder.
6. **Orphan Prevention**: Deleting a Folder recursively deletes all its descendants at the metadata level.
7. **Metadata Precedence**: Metadata state is authoritative over physical storage state.

---

## 5. Filesystem Operations

### listFolder(folder_id)
- **Input**: `folder_id` (UUID)
- **Behavior**: Returns all direct child Files and Folders of the specified Folder.
- **Failure**: Fails if `folder_id` does not exist.

### createFolder(parent_id, name)
- **Input**: `parent_id` (UUID), `name` (String)
- **Behavior**: Creates a new Folder under the specified parent.
- **Failure**: Fails if parent does not exist or if a name collision occurs.

### createFile(parent_id, file_metadata)
- **Input**: `parent_id` (UUID), file metadata (name, size, mime type)
- **Behavior**: Creates a new File entry after underlying storage is successfully prepared.
- **Failure**: Fails if parent does not exist or if a name collision occurs.

### rename(node_id, new_name)
- **Input**: `node_id` (UUID), `new_name` (String)
- **Behavior**: Updates only the `name` field of the target entity.
- **Failure**: Fails if a sibling entity already uses the new name.

### move(node_id, new_parent_id)
- **Input**: `node_id` (UUID), `new_parent_id` (UUID)
- **Behavior**:
  - Updates the `parent_id` of the entity.
  - Enforces name uniqueness in the destination.
  - Prevents cycles when moving Folders.
- **Failure**: Fails on invalid destination, name collision, or cycle detection.

### delete(node_id)
- **Input**: `node_id` (UUID)
- **Behavior**:
  - Removes the entity from the filesystem metadata.
  - Folder deletion is recursive.
  - Associated storage chunks are marked as eligible for background cleanup.
- **Edge Case**: The Root Folder cannot be deleted.

### getPath(node_id)
- **Input**: `node_id` (UUID)
- **Behavior**: Traverses parent references up to Root to construct the logical path.
- **Failure**: Fails gracefully if an invalid parent reference is encountered.

---

## 6. Failure and Recovery Model

### Source of Truth
The filesystem metadata is the single source of truth. Physical storage state is secondary and may temporarily diverge.

### Inconsistent States
- **Orphaned Chunks**: Storage data without corresponding metadata is considered garbage and may be collected asynchronously.
- **Missing Chunks**: If metadata references unavailable storage, the File is marked as corrupted while preserving filesystem structure.

### Crash Recovery
- Metadata updates must be transactional at the semantic level.
- A crash during any operation must result in either the old state or the fully-applied new state.
- Partial metadata states are forbidden.

---

## 7. Guarantees

Rivault guarantees the following to the user:
1. **Structural Integrity**: The filesystem will never contain cycles or unreachable nodes under Root.
2. **Unambiguous Addressing**: Every File and Folder can be uniquely addressed by its full path at any point in time.
3. **Navigation Availability**: Browsing and organizing files remains possible even when underlying storage is partially unavailable.
