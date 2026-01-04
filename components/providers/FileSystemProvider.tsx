"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { APIFolder, APIFile, APINode, listFolder, deleteNode, renameNode, moveNode, isFolder, getStorageStats } from "@/lib/api";

export type ViewMode = "list" | "grid";
export type FileType = "all" | "image" | "video" | "audio" | "document";

interface ExtendedContextType {
    currentPath: string; // The ID
    breadcrumbs: { id: string, name: string }[]; // NEW
    items: APINode[];
    viewMode: ViewMode;
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
    navigateTo: (folderId: string, folderName: string, absolutePath?: { id: string, name: string }[]) => void;
    navigateToBreadcrumb: (index: number) => void;
    goUp: () => void;
    toggleViewMode: () => void;
    fileTypeFilter: FileType;
    setFileTypeFilter: (type: FileType) => void;

    // CRUD wrappers
    handleDelete: (id: string) => Promise<void>;
    handleRename: (id: string, newName: string) => Promise<void>;
    handleMove: (id: string, newParentId: string) => Promise<void>;
    storageUsage: number;
}

const FileSystemContext = createContext<ExtendedContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    // We store history as array of {id, name}. Initial is root.
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'This PC' }]);

    // Derived currentPath from last breadcrumb
    const currentPath = breadcrumbs[breadcrumbs.length - 1].id;

    const [items, setItems] = useState<APINode[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>("grid"); // Default to grid view
    const [fileTypeFilter, setFileTypeFilter] = useState<FileType>("all"); // NEW
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [storageUsage, setStorageUsage] = useState(0);

    // Batch Queue State
    const pendingActions = React.useRef<Array<{ type: 'delete' | 'rename' | 'move', id: string, [key: string]: any }>>([]);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    // Flush Logic
    const flushChanges = useCallback(async () => {
        if (pendingActions.current.length === 0) return;

        const actionsToSync = [...pendingActions.current];
        pendingActions.current = []; // Clear immediately to capture new ones
        setHasPendingChanges(false);

        try {
            // Use keepalive for page exit scenarios
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api'}/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Rivault-User': 'default' },
                body: JSON.stringify({ actions: actionsToSync }),
                keepalive: true
            });
            console.log('Synced', actionsToSync.length, 'actions');
        } catch (e) {
            console.error("Sync failed", e);
            // Restore? Complex. For now, just log.
            // In a real app we might put them back in queue or show error.
            alert("Failed to sync changes to server. Please refresh.");
        }
    }, []);

    // Trigger Sync on Navigation (Route Change) or Unload
    useEffect(() => {
        // Sync when path changes (navigation within the app)
        flushChanges();

        // Cleanup function runs on unmount (or dependence change)
        return () => {
            flushChanges();
        };
    }, [currentPath, flushChanges]);

    // Handle Window Unload (Tab Close / Reload)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasPendingChanges) {
                // We cannot await here, but keepalive fetch in flushChanges handles it
                flushChanges();
                // Optional: Prompt user? "You have unsaved changes"
                // e.preventDefault();
                // e.returnValue = '';
            }
        };

        // Also listen for visibility change to be safe (mobile)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushChanges();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [hasPendingChanges, flushChanges]);

    // Fetch Content
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [nodes, stats] = await Promise.all([
                listFolder(currentPath),
                getStorageStats().catch(() => ({ totalUsed: 0 })) // Don't fail entire refresh if stats fail
            ]);
            setItems(nodes);
            setStorageUsage(stats.totalUsed);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to load folder");
            // If failed to load root or auth error, might imply bigger issue
            if (err.message.includes("401") || err.message.includes("403")) {
                router.push("/error");
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentPath, router]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Actions
    const navigateTo = (folderId: string, folderName: string, absolutePath?: { id: string, name: string }[]) => {
        if (folderId === currentPath && !absolutePath) return; // If path provided, we might force update? No, just check ID.

        setFileTypeFilter("all"); // Reset filter on navigation

        if (absolutePath) {
            setBreadcrumbs(absolutePath);
        } else {
            setBreadcrumbs(prev => {
                // Check if we are navigating to an ancestor (e.g. via Breadcrumb click)
                const existingIndex = prev.findIndex(b => b.id === folderId);
                if (existingIndex !== -1) {
                    return prev.slice(0, existingIndex + 1);
                }
                // Otherwise, drilling down
                return [...prev, { id: folderId, name: folderName }];
            });
        }
    };

    const navigateToBreadcrumb = (index: number) => {
        if (index < 0 || index >= breadcrumbs.length) return;
        setFileTypeFilter("all"); // Reset filter on navigation
        setBreadcrumbs(prev => prev.slice(0, index + 1));
    };

    const goUp = () => {
        if (breadcrumbs.length > 1) {
            setFileTypeFilter("all"); // Reset filter on navigation
            setBreadcrumbs(prev => prev.slice(0, prev.length - 1));
        }
    };

    const toggleViewMode = () => setViewMode(prev => prev === "grid" ? "list" : "grid");

    const handleDelete = async (id: string) => {
        // Optimistic Update
        setItems(prev => prev.filter(i => i.id !== id));
        // Queue
        pendingActions.current.push({ type: 'delete', id });
        setHasPendingChanges(true);
    };

    const handleRename = async (id: string, newName: string) => {
        // Optimistic Update
        setItems(prev => prev.map(i => i.id === id ? { ...i, name: newName, updatedAt: Date.now() } : i));
        // Queue
        pendingActions.current.push({ type: 'rename', id, name: newName });
        setHasPendingChanges(true);
    };

    const handleMove = async (id: string, newParentId: string) => {
        // Optimistic: If moving to different folder, remove from view.
        // If moving to THIS folder (unlikely), valid?

        // Assuming current view is source:
        setItems(prev => prev.filter(i => i.id !== id));

        // Queue
        pendingActions.current.push({ type: 'move', id, newParentId });
        setHasPendingChanges(true);
    };

    return (
        <FileSystemContext.Provider
            value={{
                currentPath,
                breadcrumbs,
                items,
                viewMode,
                isLoading,
                error,
                refresh,
                navigateTo,
                navigateToBreadcrumb,
                goUp,
                toggleViewMode,
                fileTypeFilter,
                setFileTypeFilter,
                handleDelete,
                handleRename,
                handleMove,
                storageUsage // Exported
            }}
        >
            {children}
        </FileSystemContext.Provider>
    );
}

export function useFileSystem() {
    const context = useContext(FileSystemContext);
    if (context === undefined) {
        throw new Error("useFileSystem must be used within a FileSystemProvider");
    }
    return context;
}
