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

    navigateTo: (folderId: string, folderName: string) => void; // Updated signature
    navigateToBreadcrumb: (index: number) => void; // NEW
    goUp: () => void;
    toggleViewMode: () => void;
    fileTypeFilter: FileType; // NEW
    setFileTypeFilter: (type: FileType) => void; // NEW

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
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'Root' }]);

    // Derived currentPath from last breadcrumb
    const currentPath = breadcrumbs[breadcrumbs.length - 1].id;

    const [items, setItems] = useState<APINode[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>("grid"); // Default to grid view
    const [fileTypeFilter, setFileTypeFilter] = useState<FileType>("all"); // NEW
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [storageUsage, setStorageUsage] = useState(0);

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
    const navigateTo = (folderId: string, folderName: string) => {
        if (folderId === currentPath) return;
        setFileTypeFilter("all"); // Reset filter on navigation
        setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
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
        try {
            await deleteNode(id);
            refresh();
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    const handleRename = async (id: string, newName: string) => {
        try {
            await renameNode(id, newName);
            refresh();
        } catch (e: any) {
            alert("Failed to rename: " + e.message);
        }
    };

    const handleMove = async (id: string, newParentId: string) => {
        try {
            await moveNode(id, newParentId);
            refresh();
        } catch (e: any) {
            alert("Failed to move: " + e.message);
        }
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
