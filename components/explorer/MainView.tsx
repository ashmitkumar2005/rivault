"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFileSystem } from "@/components/providers/FileSystemProvider";
import { APIFile, APIFolder, APINode, isFolder, uploadFile, createFolder, getDownloadUrl, moveNode } from "@/lib/api";
import {
    ArrowUp, FolderPlus, UploadCloud, MoreHorizontal, RefreshCw,
    Trash2, Edit2, FileText, Folder as FolderIcon, Music, Image as ImageIcon, Video, File, Search, ArrowLeft,
    CheckSquare, Square, Check
} from "lucide-react";
import ContextMenu from "@/components/ui/ContextMenu";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InputModal from "@/components/ui/InputModal";
import Modal from "@/components/ui/Modal";

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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [isSelectMode, setIsSelectMode] = useState(false);

    // Modal States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [renameModal, setRenameModal] = useState<{ isOpen: boolean, id: string, name: string }>({ isOpen: false, id: '', name: '' });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, count: number }>({ isOpen: false, count: 0 });
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean, title: string, message: string }>({ isOpen: false, title: '', message: '' });

    // Reset selection and search when path changes
    useEffect(() => {
        setSearchQuery("");
        setSelectedIds(new Set());
        setIsSelectMode(false);
    }, [currentPath]);

    // Filter items
    const filteredItems = useMemo(() => {
        let res = items;

        // 1. Type Filter
        if (fileTypeFilter !== 'all') {
            res = res.filter(item => {
                if (isFolder(item)) return false;
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
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    setUploadProgress({ name: file.name, percent: 0 });
                    await uploadFile(currentPath, file, (p) => setUploadProgress({ name: file.name, percent: p }));
                } catch (err: any) {
                    console.error(err);
                    setAlertModal({ isOpen: true, title: 'Upload Failed', message: `Failed to upload ${file.name}: ${err.message}` });
                }
            }
            setUploadProgress(null);
            refresh();
        }
    };

    const handleCreateSubmit = async (name: string) => {
        try {
            await createFolder(currentPath, name);
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Error', message: e.message });
        }
    };

    // --- Interaction ---

    const toggleSelection = (id: string, multi: boolean) => {
        const newSet = new Set(multi ? selectedIds : []);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const onDoubleClick = (item: APIFile | APIFolder) => {
        if (isSelectMode) return;

        if (isFolder(item)) {
            navigateTo(item.id, item.name);
        } else {
            window.open(getDownloadUrl(item.id), "_blank");
        }
    };

    const onRightClick = (e: React.MouseEvent, item: APIFile | APIFolder) => {
        e.preventDefault();
        if (!selectedIds.has(item.id)) {
            setSelectedIds(new Set([item.id]));
        }
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item
        });
    };

    // --- Action Handlers (triggered by toolbar or context menu) ---

    const initiateDelete = () => {
        if (selectedIds.size === 0) return;
        setDeleteModal({ isOpen: true, count: selectedIds.size });
    };

    const confirmDelete = async () => {
        try {
            for (const id of selectedIds) {
                await handleDelete(id);
            }
            setSelectedIds(new Set());
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Delete Failed', message: e.message });
        }
    };

    const initiateRename = () => {
        if (selectedIds.size !== 1) return;
        const [id] = Array.from(selectedIds);
        const item = items.find(i => i.id === id);
        if (item) {
            setRenameModal({ isOpen: true, id, name: item.name });
        }
    };

    const confirmRename = async (newName: string) => {
        try {
            await handleRename(renameModal.id, newName);
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Rename Failed', message: e.message });
        }
    };

    const handleContextAction = (action: string, item: APIFile | APIFolder) => {
        setContextMenu(null);

        switch (action) {
            case 'open':
                onDoubleClick(item);
                break;
            case 'download':
                window.open(getDownloadUrl(item.id), "_blank");
                break;
            case 'rename':
                setSelectedIds(new Set([item.id]));
                // We need to wait for state update? No, setSelectedIds is sync enough for the next render, 
                // but initiateRename reads from selectedIds. Better to explicitly pass ID or set generic state.
                // Actually initiateRename reads state. Let's just set the modal state directly here safely.
                setRenameModal({ isOpen: true, id: item.id, name: item.name });
                break;
            case 'delete':
                if (!selectedIds.has(item.id)) {
                    setSelectedIds(new Set([item.id]));
                    setDeleteModal({ isOpen: true, count: 1 });
                } else {
                    setDeleteModal({ isOpen: true, count: selectedIds.size });
                }
                break;
        }
    };

    // --- Drag & Drop ---

    const handleDragStart = (e: React.DragEvent, item: APIFile | APIFolder) => {
        if (!selectedIds.has(item.id)) {
            setSelectedIds(new Set([item.id]));
        }
        e.dataTransfer.setData("text/nodeId", item.id);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("text/nodeId");

        const idsToMove = selectedIds.has(draggedId) ? Array.from(selectedIds) : [draggedId];

        let movedCount = 0;
        for (const id of idsToMove) {
            if (id && id !== targetFolderId) {
                try {
                    await moveNode(id, targetFolderId);
                    movedCount++;
                } catch (e: any) {
                    console.error("Failed to move", id, e);
                    setAlertModal({ isOpen: true, title: 'Move Failed', message: e.message });
                }
            }
        }

        if (movedCount > 0) refresh();
    };

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden backdrop-blur-sm bg-black/30" onClick={() => setContextMenu(null)}>
            {/* Toolbar */}
            <div className="h-16 flex items-center px-4 md:px-6 space-x-2 md:space-x-4 border-b border-white/5 bg-transparent sticky top-0 z-30">
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

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                {/* Search Input */}
                <div className="relative group w-32 md:w-64 max-w-[200px] transition-all focus-within:max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search"
                        className="w-full bg-black/20 border border-white/10 text-zinc-200 text-sm rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-black/40 transition-all placeholder-zinc-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                {/* Selection Controls */}
                <button
                    onClick={() => setIsSelectMode(!isSelectMode)}
                    className={`p-2 rounded-xl transition-all ${isSelectMode ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:text-white"}`}
                    title="Toggle Selection Mode"
                >
                    <CheckSquare size={18} />
                </button>

                {selectedIds.size > 0 ? (
                    <div className="flex items-center space-x-2 animate-fade-in bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-blue-200 mr-2">{selectedIds.size} Selected</span>
                        {selectedIds.size === 1 && (
                            <button onClick={initiateRename} className="p-2 hover:bg-white/10 rounded-lg text-zinc-300 transition-colors" title="Rename">
                                <Edit2 size={16} />
                            </button>
                        )}
                        <div className="w-px h-4 bg-white/10" />
                        <button onClick={initiateDelete} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setIsCreateOpen(true)} className="hidden md:flex glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium items-center space-x-2">
                            <FolderPlus size={18} className="text-blue-400" />
                            <span>New Folder</span>
                        </button>
                        {/* Mobile New Folder Icon */}
                        <button onClick={() => setIsCreateOpen(true)} className="md:hidden p-2 rounded-xl text-zinc-200 hover:text-white">
                            <FolderPlus size={20} className="text-blue-400" />
                        </button>

                        <label className="glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium flex items-center space-x-2 cursor-pointer shadow-lg shadow-purple-900/10">
                            <UploadCloud size={18} className="text-purple-400" />
                            <span className="hidden md:inline">Upload</span>
                            <input type="file" multiple className="hidden" onChange={onUpload} disabled={!!uploadProgress} />
                        </label>
                    </>
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
            <div className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">
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
                        {/* Header Row */}
                        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-semibold uppercase text-zinc-500 tracking-wider mb-2 border-b border-white/5 items-center">
                            <div className="w-6 flex justify-center">
                                {isSelectMode && (
                                    <button onClick={selectAll} className="text-zinc-500 hover:text-white transition-colors">
                                        {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                )}
                            </div>
                            <div className="w-8"></div>
                            <div>Name</div>
                            <div className="w-24 hidden md:block">Type</div>
                            <div className="w-20 md:w-24 text-right md:text-left">Size</div>
                            <div className="w-24 hidden md:block">Modified</div>
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
                                const isSel = selectedIds.has(item.id);
                                const isDir = isFolder(item);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isSelectMode || e.ctrlKey || e.metaKey) {
                                                toggleSelection(item.id, true);
                                            } else {
                                                if (isSel && selectedIds.size === 1) {
                                                    // Already selected single
                                                } else {
                                                    setSelectedIds(new Set([item.id]));
                                                }
                                            }
                                        }}
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
                                        className={`group grid grid-cols-[auto_auto_1fr_auto_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 ${isSel
                                            ? "bg-blue-600/20 shadow-lg shadow-blue-900/10 ring-1 ring-blue-500/30"
                                            : "hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="w-6 flex justify-center">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSel
                                                ? "bg-blue-500 border-blue-500"
                                                : "border-zinc-700 group-hover:border-zinc-500"
                                                } ${!isSel && !isSelectMode ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                                                {isSel && <Check size={12} className="text-white" />}
                                            </div>
                                        </div>

                                        <div className="w-8 flex justify-center">
                                            {isDir ? (
                                                <FolderIcon size={20} className="text-yellow-500/80 group-hover:text-yellow-400 transition-colors" />
                                            ) : (
                                                getFileIcon((item as APIFile).name)
                                            )}
                                        </div>
                                        <div className={`font-medium truncate ${isSel ? "text-blue-100" : "text-zinc-300 group-hover:text-white"}`}>
                                            {item.name}
                                        </div>
                                        <div className="w-24 text-sm text-zinc-500 hidden md:block">{isDir ? 'Folder' : 'File'}</div>
                                        <div className="w-20 md:w-24 text-sm text-zinc-500 text-right md:text-left">{isDir ? '-' : formatSize((item as APIFile).size)}</div>
                                        <div className="w-32 text-sm text-zinc-600 group-hover:text-zinc-500 hidden md:block">
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

            {/* Modals */}

            {/* Create Folder */}
            <InputModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSubmit={handleCreateSubmit}
                title="New Folder"
                placeholder="Folder Name"
                submitLabel="Create"
            />

            {/* Rename */}
            <InputModal
                isOpen={renameModal.isOpen}
                onClose={() => setRenameModal({ ...renameModal, isOpen: false })}
                onSubmit={confirmRename}
                title="Rename Item"
                initialValue={renameModal.name}
                submitLabel="Rename"
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                onConfirm={confirmDelete}
                title="Delete Items"
                message={`Are you sure you want to delete ${deleteModal.count} item(s)? This action cannot be undone.`}
                confirmLabel="Delete"
                isDestructive={true}
            />

            {/* Alert / Error */}
            <Modal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                footer={
                    <button
                        onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        Close
                    </button>
                }
            >
                <p>{alertModal.message}</p>
            </Modal>


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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSelectMode, setIsSelectMode] = useState(false);

    // Reset selection and search when path changes
    useEffect(() => {
        setSearchQuery("");
        setSelectedIds(new Set());
        setIsSelectMode(false);
    }, [currentPath]);

    // Filter items
    const filteredItems = useMemo(() => {
        let res = items;

        // 1. Type Filter
        if (fileTypeFilter !== 'all') {
            res = res.filter(item => {
                if (isFolder(item)) return false;
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
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    setUploadProgress({ name: file.name, percent: 0 });
                    await uploadFile(currentPath, file, (p) => setUploadProgress({ name: file.name, percent: p }));
                } catch (err: any) {
                    console.error(err);
                    alert(`Upload failed for ${file.name}: ${err.message || err}`);
                }
            }
            setUploadProgress(null);
            refresh();
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

    const toggleSelection = (id: string, multi: boolean) => {
        const newSet = new Set(multi ? selectedIds : []);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const onDoubleClick = (item: APIFile | APIFolder) => {
        if (isSelectMode) return; // No double click nav in select mode? Or maybe just allow it?

        if (isFolder(item)) {
            navigateTo(item.id, item.name);
        } else {
            window.open(getDownloadUrl(item.id), "_blank");
        }
    };

    const onRightClick = (e: React.MouseEvent, item: APIFile | APIFolder) => {
        e.preventDefault();
        if (!selectedIds.has(item.id)) {
            setSelectedIds(new Set([item.id]));
        }
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item
        });
    };

    const onDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedIds.size} item(s)?`)) {
            for (const id of selectedIds) {
                await handleDelete(id);
            }
            setSelectedIds(new Set());
            refresh();
        }
    };

    const onRename = async () => {
        if (selectedIds.size !== 1) return;
        const [id] = Array.from(selectedIds);
        const newName = prompt("New Name:");
        if (newName) {
            await handleRename(id, newName);
            refresh();
        }
    };

    const handleContextAction = (action: string, item: APIFile | APIFolder) => {
        setContextMenu(null);

        switch (action) {
            case 'open':
                onDoubleClick(item);
                break;
            case 'download':
                window.open(getDownloadUrl(item.id), "_blank");
                break;
            case 'rename':
                // Ensure only this item is selected for rename
                setSelectedIds(new Set([item.id]));
                setTimeout(onRename, 50);
                break;
            case 'delete':
                // Use existing selection if it includes the target, otherwise select just target
                if (!selectedIds.has(item.id)) {
                    setSelectedIds(new Set([item.id]));
                }
                setTimeout(onDelete, 50);
                break;
        }
    };

    // --- Drag & Drop ---

    const handleDragStart = (e: React.DragEvent, item: APIFile | APIFolder) => {
        if (!selectedIds.has(item.id)) {
            setSelectedIds(new Set([item.id]));
        }
        e.dataTransfer.setData("text/nodeId", item.id);
        // Could serialize all selected IDs here for multi-move
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("text/nodeId");

        // If we have a selection, move all of them (simple implementation for now: only move the dragged one if simple drag)
        // Ideally we iterate selectedIds.

        const idsToMove = selectedIds.has(draggedId) ? Array.from(selectedIds) : [draggedId];

        let movedCount = 0;
        for (const id of idsToMove) {
            if (id && id !== targetFolderId) {
                try {
                    await moveNode(id, targetFolderId);
                    movedCount++;
                } catch (e: any) { console.error("Failed to move", id, e); }
            }
        }

        if (movedCount > 0) refresh();
    };

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden backdrop-blur-sm bg-black/30" onClick={() => setContextMenu(null)}>
            {/* Toolbar */}
            <div className="h-16 flex items-center px-4 md:px-6 space-x-2 md:space-x-4 border-b border-white/5 bg-transparent sticky top-0 z-30">
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

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                {/* Search Input */}
                <div className="relative group w-32 md:w-64 max-w-[200px] transition-all focus-within:max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search"
                        className="w-full bg-black/20 border border-white/10 text-zinc-200 text-sm rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-black/40 transition-all placeholder-zinc-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                {/* Selection Controls */}
                <button
                    onClick={() => setIsSelectMode(!isSelectMode)}
                    className={`p-2 rounded-xl transition-all ${isSelectMode ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:text-white"}`}
                    title="Toggle Selection Mode"
                >
                    <CheckSquare size={18} />
                </button>

                {selectedIds.size > 0 ? (
                    <div className="flex items-center space-x-2 animate-fade-in bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-blue-200 mr-2">{selectedIds.size} Selected</span>
                        {selectedIds.size === 1 && (
                            <button onClick={onRename} className="p-2 hover:bg-white/10 rounded-lg text-zinc-300 transition-colors" title="Rename">
                                <Edit2 size={16} />
                            </button>
                        )}
                        <div className="w-px h-4 bg-white/10" />
                        <button onClick={onDelete} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ) : (
                    <>
                        <button onClick={onCreateFolderClick} className="hidden md:flex glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium items-center space-x-2">
                            <FolderPlus size={18} className="text-blue-400" />
                            <span>New Folder</span>
                        </button>
                        {/* Mobile New Folder Icon */}
                        <button onClick={onCreateFolderClick} className="md:hidden p-2 rounded-xl text-zinc-200 hover:text-white">
                            <FolderPlus size={20} className="text-blue-400" />
                        </button>

                        <label className="glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium flex items-center space-x-2 cursor-pointer shadow-lg shadow-purple-900/10">
                            <UploadCloud size={18} className="text-purple-400" />
                            <span className="hidden md:inline">Upload</span>
                            <input type="file" multiple className="hidden" onChange={onUpload} disabled={!!uploadProgress} />
                        </label>
                    </>
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
            <div className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">
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
                        {/* Header Row */}
                        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-semibold uppercase text-zinc-500 tracking-wider mb-2 border-b border-white/5 items-center">
                            <div className="w-6 flex justify-center">
                                {isSelectMode && (
                                    <button onClick={selectAll} className="text-zinc-500 hover:text-white transition-colors">
                                        {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                )}
                            </div>
                            <div className="w-8"></div>
                            <div>Name</div>
                            <div className="w-24 hidden md:block">Type</div>
                            <div className="w-20 md:w-24 text-right md:text-left">Size</div>
                            <div className="w-24 hidden md:block">Modified</div>
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
                                const isSel = selectedIds.has(item.id);
                                const isDir = isFolder(item);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Usage logic:
                                            // Select Mode ON: click toggles selection
                                            // Select Mode OFF: 
                                            //   - Click selects ONLY this item
                                            //   - Ctrl/Cmd+Click toggles this item
                                            //   - Shift+Click (TODO: range select, for now just add)
                                            if (isSelectMode || e.ctrlKey || e.metaKey) {
                                                toggleSelection(item.id, true);
                                            } else {
                                                if (isSel && selectedIds.size === 1) {
                                                    // Already selected single, do nothing (or deselect?)
                                                } else {
                                                    setSelectedIds(new Set([item.id]));
                                                }
                                            }
                                        }}
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
                                        className={`group grid grid-cols-[auto_auto_1fr_auto_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 ${isSel
                                            ? "bg-blue-600/20 shadow-lg shadow-blue-900/10 ring-1 ring-blue-500/30"
                                            : "hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="w-6 flex justify-center">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSel
                                                ? "bg-blue-500 border-blue-500"
                                                : "border-zinc-700 group-hover:border-zinc-500"
                                                } ${!isSel && !isSelectMode ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                                                {isSel && <Check size={12} className="text-white" />}
                                            </div>
                                        </div>

                                        <div className="w-8 flex justify-center">
                                            {isDir ? (
                                                <FolderIcon size={20} className="text-yellow-500/80 group-hover:text-yellow-400 transition-colors" />
                                            ) : (
                                                getFileIcon((item as APIFile).name)
                                            )}
                                        </div>
                                        <div className={`font-medium truncate ${isSel ? "text-blue-100" : "text-zinc-300 group-hover:text-white"}`}>
                                            {item.name}
                                        </div>
                                        <div className="w-24 text-sm text-zinc-500 hidden md:block">{isDir ? 'Folder' : 'File'}</div>
                                        <div className="w-20 md:w-24 text-sm text-zinc-500 text-right md:text-left">{isDir ? '-' : formatSize((item as APIFile).size)}</div>
                                        <div className="w-32 text-sm text-zinc-600 group-hover:text-zinc-500 hidden md:block">
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
