"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFileSystem } from "@/components/providers/FileSystemProvider";
import { APIFile, APIFolder, APINode, isFolder, uploadFile, createFolder, getDownloadUrl, moveNode } from "@/lib/api";
import {
    ArrowUp, FolderPlus, UploadCloud, MoreHorizontal, RefreshCw,
    Trash2, Edit2, FileText, Folder as FolderIcon, Music, Image as ImageIcon, Video, File, Search, ArrowLeft
} from "lucide-react";
import ContextMenu from "@/components/ui/ContextMenu";
import Breadcrumb from "@/components/Breadcrumb";

function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) return <Music size={20} className="text-pink-400" />;
    if (['jpg', 'png', 'gif', 'jpeg'].includes(ext || '')) return <ImageIcon size={20} className="text-purple-400" />;
    if (['mp4', 'mkv', 'mov'].includes(ext || '')) return <Video size={20} className="text-red-400" />;
    return <FileText size={20} className="text-blue-400" />;
}

export default function MainView() {
    const {
        currentPath, items, isLoading, error, refresh,
        navigateTo, goUp, breadcrumbs, navigateToBreadcrumb,
        handleDelete, handleRename, fileTypeFilter
    } = useFileSystem();

    const [uploadProgress, setUploadProgress] = useState<{ name: string, percent: number } | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Reset search when path changes
    useEffect(() => {
        setSearchQuery("");
    }, [currentPath]);

    // Filter items
    const filteredItems = useMemo(() => {
        let res = items;

        // 1. Type Filter
        if (fileTypeFilter !== 'all') {
            res = res.filter(item => {
                if (isFolder(item)) return false; // Hide folders when filtering by type?? Or show them? 
                // Decision: Hide folders when specific type filter is active to show only that type of files.
                const file = item as APIFile;
                const ext = file.name.split('.').pop()?.toLowerCase() || '';

                if (fileTypeFilter === 'image') return ['jpg', 'png', 'gif', 'jpeg', 'webp', 'svg', 'bmp'].includes(ext);
                if (fileTypeFilter === 'video') return ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'].includes(ext);
                if (fileTypeFilter === 'audio') return ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext);
                if (fileTypeFilter === 'document') return ['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
                return false;
            });
        }

        // 2. Search Query
        if (searchQuery) {
            res = res.filter((item: APINode) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return res;
    }, [items, searchQuery, fileTypeFilter]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: APIFile | APIFolder } | null>(null);

    // --- Toolbar Actions ---

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                setUploadProgress({ name: file.name, percent: 0 });
                await uploadFile(currentPath, file, (p) => setUploadProgress({ name: file.name, percent: p }));
                setUploadProgress(null);
                refresh();
            } catch (err) {
                alert("Upload failed");
                setUploadProgress(null);
            }
        }
    };

    const onCreateFolderClick = () => {
        setNewFolderName("");
        setIsCreateOpen(true);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await createFolder(currentPath, newFolderName);
            refresh();
            setIsCreateOpen(false);
        } catch (e: any) {
            alert("Failed to create folder: " + e.message);
        }
    };

    // --- Interaction ---

    const onDoubleClick = (item: APIFile | APIFolder) => {
        const itemId = item.id;
        if (isFolder(item)) {
            navigateTo(itemId, item.name);
        } else {
            // Open in new tab which triggers download
            window.open(getDownloadUrl(itemId), "_blank");
        }
    };

    const onRightClick = (e: React.MouseEvent, item: APIFile | APIFolder) => {
        e.preventDefault();
        setSelectedId(item.id);
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item
        });
    };

    const onDelete = async () => {
        if (!selectedId) return;
        if (confirm("Are you sure you want to delete this item?")) {
            await handleDelete(selectedId);
            setSelectedId(null);
        }
    };

    const onRename = async () => {
        if (!selectedId) return;
        const newName = prompt("New Name:");
        if (newName) {
            await handleRename(selectedId, newName);
        }
    };

    const handleContextAction = (action: string, item: APIFile | APIFolder) => {
        setContextMenu(null); // Close menu

        switch (action) {
            case 'open':
                onDoubleClick(item);
                break;
            case 'download':
                window.open(getDownloadUrl(item.id), "_blank");
                break;
            case 'rename':
                setSelectedId(item.id);
                // Tiny timeout to let menu close visually before prompt (browser native prompt blocks UI)
                setTimeout(onRename, 50);
                break;
            case 'delete':
                setSelectedId(item.id);
                setTimeout(onDelete, 50);
                break;
        }
    };

    // --- Drag & Drop ---

    const handleDragStart = (e: React.DragEvent, item: APIFile | APIFolder) => {
        e.dataTransfer.setData("text/nodeId", item.id);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const nodeId = e.dataTransfer.getData("text/nodeId");
        if (nodeId && nodeId !== targetFolderId) {
            try {
                await moveNode(nodeId, targetFolderId);
                refresh();
            } catch (e: any) { alert("Failed to move: " + e.message); }
        }
    };

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden backdrop-blur-sm bg-black/30" onClick={() => setContextMenu(null)}>
            {/* Toolbar */}
            <div className="h-16 flex items-center px-6 space-x-4 border-b border-white/5 bg-transparent sticky top-0 z-30">
                <div className="flex-1 overflow-hidden flex items-center">
                    <button
                        onClick={goUp}
                        disabled={breadcrumbs.length <= 1}
                        className={`p-2 mr-2 rounded-full transition-colors ${breadcrumbs.length <= 1
                            ? "text-zinc-600 cursor-not-allowed opacity-50"
                            : "text-zinc-400 hover:bg-white/10 hover:text-white"
                            }`}
                        title="Go Back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <Breadcrumb items={breadcrumbs} onNavigate={navigateToBreadcrumb} />
                </div>

                <div className="h-6 w-px bg-white/10 mx-2" />

                {/* Search Input */}
                <div className="relative group w-64 max-w-[200px] hidden md:block transition-all focus-within:max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search this folder"
                        className="w-full bg-black/20 border border-white/10 text-zinc-200 text-sm rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-black/40 transition-all placeholder-zinc-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                <button onClick={onCreateFolderClick} className="glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium flex items-center space-x-2">
                    <FolderPlus size={18} className="text-blue-400" />
                    <span>New Folder</span>
                </button>

                <label className="glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium flex items-center space-x-2 cursor-pointer shadow-lg shadow-purple-900/10">
                    <UploadCloud size={18} className="text-purple-400" />
                    <span>Upload</span>
                    <input type="file" className="hidden" onChange={onUpload} disabled={!!uploadProgress} />
                </label>

                <div className="flex-shrink-0" />

                {selectedId && (
                    <div className="flex items-center space-x-2 animate-fade-in bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-white/5">
                        <button onClick={onRename} className="p-2 hover:bg-white/10 rounded-lg text-zinc-300 transition-colors" title="Rename">
                            <Edit2 size={16} />
                        </button>
                        <div className="w-px h-4 bg-white/10" />
                        <button onClick={onDelete} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}

                <button onClick={refresh} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 transition-colors">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Upload Progress */}
            {uploadProgress && (
                <div className="mx-6 mt-4 glass-panel rounded-xl p-3 flex items-center justify-between animate-scale-in">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <UploadCloud size={16} className="text-blue-400 animate-bounce" />
                        </div>
                        <span className="text-sm text-zinc-200">Uploading <span className="font-medium text-white">{uploadProgress.name}</span>...</span>
                    </div>
                    <span className="text-sm font-mono text-blue-300 font-bold">{Math.round(uploadProgress.percent)}%</span>
                </div>
            )}

            {/* File List */}
            <div className="flex-1 overflow-auto p-6 scroll-smooth">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500 animate-pulse">
                        <div className="w-12 h-12 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin mb-4" />
                        <span className="text-sm">Loading contents...</span>
                    </div>
                )}

                {error && (
                    <div className="glass-panel p-6 rounded-xl border-red-500/20 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-3 text-red-400">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-red-200 font-medium mb-1">Could not load folder</h3>
                        <p className="text-red-400/60 text-sm">{error}</p>
                    </div>
                )}

                {!isLoading && !error && (
                    <div className="w-full">
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-semibold uppercase text-zinc-500 tracking-wider mb-2 border-b border-white/5">
                            <div className="w-8"></div>
                            <div>Name</div>
                            <div className="w-24">Type</div>
                            <div className="w-24">Size</div>
                            <div className="w-32">Modified</div>
                        </div>

                        <div className="space-y-1">
                            {filteredItems.length === 0 && (
                                <div className="py-20 flex flex-col items-center justify-center text-zinc-600">
                                    {searchQuery ? (
                                        <>
                                            <Search size={48} className="mb-4 opacity-20" />
                                            <p className="text-sm">No results found for "{searchQuery}"</p>
                                        </>
                                    ) : (
                                        <>
                                            <FolderIcon size={48} className="mb-4 opacity-20" />
                                            <p className="text-sm">This folder is empty</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {filteredItems.map(item => {
                                const isSel = selectedId === item.id;
                                const isDir = isFolder(item);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={(e) => { e.stopPropagation(); setSelectedId(item.id); }}
                                        onDoubleClick={() => onDoubleClick(item)}
                                        onContextMenu={(e) => onRightClick(e, item)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item)}
                                        onDragOver={(e) => {
                                            if (isDir) { e.preventDefault(); }
                                        }}
                                        onDrop={(e) => {
                                            if (isDir) handleDrop(e, item.id);
                                        }}
                                        className={`group grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 ${isSel
                                            ? "bg-blue-600/20 shadow-lg shadow-blue-900/10 ring-1 ring-blue-500/30"
                                            : "hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="w-8 flex justify-center">
                                            {isDir ? (
                                                <FolderIcon size={20} className="text-yellow-500/80 group-hover:text-yellow-400 transition-colors" />
                                            ) : (
                                                getFileIcon((item as APIFile).name)
                                            )}
                                        </div>
                                        <div className={`font-medium ${isSel ? "text-blue-100" : "text-zinc-300 group-hover:text-white"}`}>
                                            {item.name}
                                        </div>
                                        <div className="w-24 text-sm text-zinc-500">{isDir ? 'Folder' : 'File'}</div>
                                        <div className="w-24 text-sm text-zinc-500">{isDir ? '-' : formatSize((item as APIFile).size)}</div>
                                        <div className="w-32 text-sm text-zinc-600 group-hover:text-zinc-500">
                                            {isDir
                                                ? new Date(item.createdAt).toLocaleDateString()
                                                // @ts-ignore
                                                : new Date(item.updatedAt || item.createdAt).toLocaleDateString()
                                            }
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onClose={() => setContextMenu(null)}
                    onAction={handleContextAction}
                />
            )}

            {/* Create Folder Modal */}
            {isCreateOpen && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="glass-panel p-6 rounded-2xl w-80 shadow-2xl animate-scale-in">
                        <h3 className="text-lg font-bold text-white mb-1">New Folder</h3>
                        <p className="text-zinc-400 text-xs mb-4">Create a new container for your files.</p>

                        <form onSubmit={handleCreateSubmit}>
                            <input
                                type="text"
                                autoFocus
                                className="w-full bg-black/20 border border-white/10 text-white px-4 py-2 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500/50 outline-none placeholder-zinc-600"
                                placeholder="Folder Name"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                            />
                            <div className="flex justify-end space-x-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-900/20">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Branding Footer */}
            <div className="glass-panel border-x-0 border-b-0 py-2 text-center text-[10px] text-zinc-600 font-medium select-none z-20">
                Made with <span className="inline-block animate-pulse text-red-500 mx-1" style={{ animation: 'beat 1.5s infinite running' }}>❤️</span>
                <a href="https://ashmit-kumar.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-400 hover:text-white transition-colors tracking-wide">Riveror</a>
                <style jsx>{`
                    @keyframes beat {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.25); opacity: 0.8; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
                    }
                `}</style>
            </div>
        </div>
    );
}
