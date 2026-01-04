"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFileSystem } from "@/components/providers/FileSystemProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { APIFile, APIFolder, APINode, isFolder, uploadFile, createFolder, getDownloadUrl, moveNode, downloadAndDecryptFile, lockNode, unlockNode, verifyLock } from "@/lib/api";
import {
    ArrowUp, ArrowDown, FolderPlus, UploadCloud, MoreHorizontal, RefreshCw,
    Trash2, Edit2, FileText, Folder as FolderIcon, Music, Image as ImageIcon, Video, File as LucideFile, Search, ArrowLeft,
    CheckSquare, Square, Check, ChevronUp, ChevronDown, List, LayoutGrid,
    FileCode, Archive, FileSpreadsheet, FileJson, FileType as FileTypeIcon, Lock, HardDrive
} from "lucide-react";
import ContextMenu from "@/components/ui/ContextMenu";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InputModal from "@/components/ui/InputModal";
import Modal from "@/components/ui/Modal";
import PreviewModal from "./PreviewModal";
import FilePreviewContent from "./FilePreviewContent";
import FileSkeleton from "./FileSkeleton";
import CompressModal from './CompressModal';
import { TextEditorModal } from './TextEditorModal';
import SelectionBox from './SelectionBox';
import { createZip, extractZip } from "@/lib/archive";

function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext || '')) return <Music size={20} className="text-pink-400" />;
    if (['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'].includes(ext || '')) return <ImageIcon size={20} className="text-purple-400" />;
    if (['mp4', 'mkv', 'mov', 'webm'].includes(ext || '')) return <Video size={20} className="text-red-400" />;
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext || '')) return <FileText size={20} className="text-blue-400" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return <Archive size={20} className="text-orange-400" />;
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet size={20} className="text-emerald-400" />;
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'cpp', 'h', 'c', 'cs', 'html', 'css'].includes(ext || '')) return <FileCode size={20} className="text-amber-400" />;
    if (['json', 'yaml', 'yml', 'xml'].includes(ext || '')) return <FileJson size={20} className="text-cyan-400" />;
    return <FileText size={20} className="text-zinc-400" />;
}

export default function MainView() {
    const {
        currentPath, items, isLoading, error, refresh,
        navigateTo, goUp, breadcrumbs, navigateToBreadcrumb,
        handleDelete, handleRename, handleMove, fileTypeFilter,
        viewMode, toggleViewMode
    } = useFileSystem();
    const { masterPassword, logout } = useAuth();

    const [uploadProgress, setUploadProgress] = useState<{ name: string, percent: number } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'size' | 'date', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [isDraggingFile, setIsDraggingFile] = useState(false); // New state for OS file drag
    const dragCounter = React.useRef(0); // To handle enter/leave nesting

    // Modal States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateFileOpen, setIsCreateFileOpen] = useState(false);
    const [createFileType, setCreateFileType] = useState<'any' | 'txt'>('any');
    const [renameModal, setRenameModal] = useState<{ isOpen: boolean, id: string, name: string }>({ isOpen: false, id: '', name: '' });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, count: number }>({ isOpen: false, count: 0 });
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean, title: string, message: string }>({ isOpen: false, title: '', message: '' });
    const [previewItem, setPreviewItem] = useState<{ file: APIFile, password?: string } | null>(null);
    const [compressModal, setCompressModal] = useState<{ isOpen: boolean, items: APIFile[] }>({ isOpen: false, items: [] });
    const [textEditor, setTextEditor] = useState<{ isOpen: boolean, file: APIFile | null, content: string }>({ isOpen: false, file: null, content: '' });
    const [lockModal, setLockModal] = useState<{ isOpen: boolean, item: APIFile | APIFolder | null }>({ isOpen: false, item: null });
    const [unlockModal, setUnlockModal] = useState<{ isOpen: boolean, item: APIFile | APIFolder | null, action: 'open' | 'download' | 'delete' | 'unlock' }>({ isOpen: false, item: null, action: 'open' });

    // Box Selection State
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionCurrent, setSelectionCurrent] = useState<{ x: number, y: number } | null>(null);
    const selectionRef = React.useRef<{ start: { x: number, y: number } | null, justFinishedSelection?: boolean }>({ start: null, justFinishedSelection: false });

    // Reset selection and search when path changes
    useEffect(() => {
        setSearchQuery("");
        setSelectedIds(new Set());
        setFocusedId(null);
        setIsSelectMode(false);
    }, [currentPath]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete') {
                if (selectedIds.size > 0 || focusedId) {
                    // Use focusedId if selection is empty but something is focused?
                    // Standard logic: If specific selection handling exists, use it.
                    // Here `initiateDelete` uses `selectedIds`.
                    // Ideally, if nothing selected but one item focused, we should select it then delete?
                    // For now, let's stick to explicitly selected items or focused item if selection is empty.
                    if (selectedIds.size === 0 && focusedId) {
                        setSelectedIds(new Set([focusedId]));
                        setDeleteModal({ isOpen: true, count: 1 });
                    } else if (selectedIds.size > 0) {
                        initiateDelete();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, focusedId]);

    // Filter and sort items
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
            res = res.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // 3. Sorting
        return [...res].sort((a, b) => {
            // Folders always first
            const aIsDir = isFolder(a);
            const bIsDir = isFolder(b);
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;

            let comparison = 0;
            if (sortConfig.key === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortConfig.key === 'size') {
                const aSize = isFolder(a) ? 0 : (a as APIFile).size;
                const bSize = isFolder(b) ? 0 : (b as APIFile).size;
                comparison = aSize - bSize;
            } else if (sortConfig.key === 'date') {
                const aDate = new Date(a.createdAt).getTime();
                const bDate = new Date(b.createdAt).getTime();
                comparison = aDate - bDate;
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [items, searchQuery, fileTypeFilter, sortConfig]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item?: APIFile | APIFolder, type?: 'item' | 'background' } | null>(null);

    const onBackgroundContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        // Only show background menu if we didn't right-click an item (stopPropagation handled by items)
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type: 'background'
        });
    };

    // --- Toolbar Actions ---

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    setUploadProgress({ name: file.name, percent: 0 });
                    await uploadFile(currentPath, file, masterPassword || undefined, (p) => setUploadProgress({ name: file.name, percent: p }));
                } catch (err: any) {
                    console.error(err);
                    setAlertModal({ isOpen: true, title: 'Upload Failed', message: `Failed to upload ${file.name}: ${err.message} ` });
                }
            }
            setUploadProgress(null);
            refresh();
        }
    };

    const handleSecureDownload = async (item: APIFile, lockPassword?: string) => {
        try {
            if (item.locked && !lockPassword) {
                setUnlockModal({ isOpen: true, item, action: 'download' });
                return;
            }

            const blob = await downloadAndDecryptFile(item, masterPassword || undefined, lockPassword);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            console.error(err);
            setAlertModal({ isOpen: true, title: 'Download Failed', message: err.message });
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

    const handleCreateFileSubmit = async (name: string) => {
        try {
            let finalName = name;
            // Auto-append .txt if in txt mode and extension is missing
            if (createFileType === 'txt' && !finalName.toLowerCase().endsWith('.txt')) {
                finalName = `${finalName}.txt`;
            }

            // Create an empty file with the given name
            const emptyFile = new File([], finalName, { type: 'application/octet-stream' });
            await uploadFile(currentPath, emptyFile, masterPassword || undefined);
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Error', message: e.message });
        }
    };

    // --- Interaction ---

    const toggleSelection = (id: string, multi: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(multi ? prev : []);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const toggleSort = (key: 'name' | 'size' | 'date') => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }: { column: 'name' | 'size' | 'date' }) => {
        if (sortConfig.key !== column) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
    };

    const selectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const onDoubleClick = async (item: APIFile | APIFolder) => {
        if (isSelectMode) return;

        if (item.locked) {
            setUnlockModal({ isOpen: true, item, action: 'open' });
            return;
        }

        if (isFolder(item)) {
            navigateTo(item.id, item.name);
        } else {
            // Check if text file to open editor
            const ext = item.name.split('.').pop()?.toLowerCase() || '';
            const textExts = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bat', 'env', 'gitignore'];

            if (textExts.includes(ext)) {
                try {
                    // Show some loading indicator? AlertModal with "Loading..." isn't ideal but works for now or reuse existing loading states
                    // We don't have a generic loading modal, so let's use Alert temporarily or just wait
                    // Setting previewItem logic had no loader, it just opened. 
                    // But decryption takes time.

                    // Let's assume fast decryption for small text files. 
                    const blob = await downloadAndDecryptFile(item as APIFile, masterPassword || undefined);
                    const text = await blob.text();
                    setTextEditor({ isOpen: true, file: item as APIFile, content: text });
                } catch (e: any) {
                    setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to open file: ' + e.message });
                }
            } else {
                setPreviewItem({ file: item as APIFile });
            }
        }
    };

    const handleEditorSave = async (content: string) => {
        if (!textEditor.file) return;
        try {
            // Create file object from content
            const file = new File([content], textEditor.file.name, { type: textEditor.file.mimeType || 'text/plain' });

            // Upload with overwrite=true
            // note: uploadFile signature in MainView usage needs update or it just passes args
            // The uploadFile imported from @/lib/api has been updated to accept overwrite as 5th arg.
            // But existing usages in MainView might be using only 4 args (onProgress).
            // We need to pass 5th arg.

            await uploadFile(currentPath, file, masterPassword || undefined, undefined, true);
            refresh();
        } catch (e: any) {
            console.error(e);
            throw new Error(e.message);
        }
    };

    const onRightClick = (e: React.MouseEvent, item: APIFile | APIFolder) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent background menu from appearing
        // If not selected, select it? Or just focus it?
        // Standard: Right click selects/focuses the target.
        if (!selectedIds.has(item.id)) {
            setFocusedId(item.id);
            // Fix: Explicitly select the item on right click if not already selected
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

        // Check for locked items
        const selectedItems = items.filter(i => selectedIds.has(i.id));
        const lockedItems = selectedItems.filter(i => i.locked);

        if (lockedItems.length > 0) {
            if (selectedIds.size === 1) {
                // Single locked item - prompt for password
                setUnlockModal({ isOpen: true, item: lockedItems[0], action: 'delete' });
                return;
            } else {
                // Multiple items with at least one locked
                setAlertModal({
                    isOpen: true,
                    title: 'Action Denied',
                    message: 'Cannot delete locked items with bulk selection. Please unlock them individually or delete them one by one.'
                });
                return;
            }
        }

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

    // --- Global Drag and Drop Handlers ---
    const handleGlobalDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;

        // Check if dragging files from OS
        if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
            setIsDraggingFile(true);
        }
    };

    const handleGlobalDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;

        if (dragCounter.current === 0) {
            setIsDraggingFile(false);
        }
    };

    const handleGlobalDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleGlobalDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
        dragCounter.current = 0;

        // Check if it's an OS file drop
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);

            // Re-use upload logic
            let completed = 0;
            const total = files.length;

            for (const file of files) {
                try {
                    setUploadProgress({ name: file.name, percent: 0 });
                    await uploadFile(currentPath, file, masterPassword || undefined, (progress) => {
                        setUploadProgress({ name: file.name, percent: progress });
                    });
                    completed++;
                } catch (err: any) {
                    setAlertModal({ isOpen: true, title: 'Upload Failed', message: `Failed to upload ${file.name}: ${err.message}` });
                }
            }

            setUploadProgress(null);
            if (completed > 0) refresh();
        }
    };

    const handleExtract = async (item: APIFile) => {
        try {
            setAlertModal({ isOpen: true, title: 'Extracting...', message: `Unzipping ${item.name}. Please wait.` });

            const res = await fetch(getDownloadUrl(item.id));
            if (!res.ok) throw new Error("Failed to fetch archive");
            const blob = await res.blob();

            const unzipped = await extractZip(blob);

            const files = Object.entries(unzipped);
            const total = files.length;

            for (let i = 0; i < total; i++) {
                const [name, data] = files[i];
                // Skip directories (fflate represents them with trailing slash and empty data)
                if (name.endsWith('/')) continue;

                const file = new File([data as any], name);
                await uploadFile(currentPath, file, masterPassword || undefined, (p) => {
                    setAlertModal({
                        isOpen: true,
                        title: 'Extracting...',
                        message: `Processing file ${i + 1} of ${total}: ${name} (${Math.round(p)}%)`
                    });
                });
            }

            setAlertModal({ isOpen: true, title: 'Success', message: `Extracted ${total} items successfully.` });
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Extraction Failed', message: e.message });
        }
    };

    const handleCompress = async (targetItem?: APIFile) => {
        // Fallback or explicit item selection for compression
        let itemsToZip: APIFile[] = [];

        if (targetItem) {
            itemsToZip = [targetItem];
        } else {
            if (selectedIds.size === 0) return;
            itemsToZip = items.filter(i => selectedIds.has(i.id) && !isFolder(i)) as APIFile[];
        }

        if (itemsToZip.length === 0) {
            setAlertModal({ isOpen: true, title: 'Info', message: 'You can only compress files at the moment.' });
            return;
        }

        setCompressModal({ isOpen: true, items: itemsToZip });
    };

    const performCompression = async (name: string, level: number, password?: string) => {
        try {
            const itemsToZip = compressModal.items;
            setAlertModal({ isOpen: true, title: 'Compressing...', message: `Preparing ${itemsToZip.length} files.` });

            const filesForZip = [];
            for (const item of itemsToZip) {
                if (item.locked) {
                    setAlertModal({ isOpen: true, title: 'Error', message: `Cannot compress locked file: ${item.name}` });
                    return;
                }
                const blob = await downloadAndDecryptFile(item, masterPassword || undefined);
                const buffer = await blob.arrayBuffer();
                filesForZip.push({ name: item.name, data: new Uint8Array(buffer) });
            }

            const zipBlob = await createZip(filesForZip, { level, password });

            // Ensure .zip extension
            const finalName = name.endsWith('.zip') ? name : `${name}.zip`;
            const zipFile = new File([zipBlob], finalName, { type: 'application/zip' });

            await uploadFile(currentPath, zipFile, masterPassword || undefined, (p) => {
                setAlertModal({ isOpen: true, title: 'Uploading Archive...', message: `${Math.round(p)}%` });
            });

            setAlertModal({ isOpen: true, title: 'Success', message: 'Archive created successfully.' });
            setSelectedIds(new Set());
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Compression Failed', message: e.message });
        } finally {
            setCompressModal({ isOpen: false, items: [] }); // Close modal regardless of success/failure
        }
    };

    const handleLockSubmit = async (password: string) => {
        if (!lockModal.item) return;
        try {
            await lockNode(lockModal.item.id, password);
            refresh();
            setLockModal({ isOpen: false, item: null });
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Lock Failed', message: e.message });
        }
    };

    const handleUnlockSubmit = async (password: string) => {
        const { item, action } = unlockModal;
        if (!item) return;

        try {
            const valid = await verifyLock(item.id, password);
            if (!valid) {
                // Should show error in modal, but InputModal might close on submit?
                // Assuming InputModal handles error or we just alert. 
                // Let's use alert for now to keep it simple as designed in plan.
                throw new Error("Invalid Password");
            }

            if (action === 'download') {
                setUnlockModal({ isOpen: false, item: null, action: 'open' });
                handleSecureDownload(item as APIFile, password);
            } else if (action === 'open') {
                if (isFolder(item)) {
                    navigateTo(item.id, item.name);
                } else {
                    const blob = await downloadAndDecryptFile(item as APIFile, masterPassword || undefined, password);
                    const ext = item.name.split('.').pop()?.toLowerCase() || '';
                    const textExts = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'env', 'yml', 'yaml', 'xml', 'html', 'css', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'sh', 'bat', 'sql', 'gitignore', 'dockerfile'];

                    if (textExts.includes(ext)) {
                        const text = await blob.text();
                        setTextEditor({ isOpen: true, file: item as APIFile, content: text });
                    } else {
                        // Use PreviewModal for all other types, passing the password
                        setPreviewItem({ file: item as APIFile, password });
                    }
                }
                setUnlockModal({ isOpen: false, item: null, action: 'open' });
            } else if (action === 'delete') {
                // 1. Unlock permanently
                await unlockNode(item.id, password);
                // 2. Delete
                await handleDelete(item.id);

                setUnlockModal({ isOpen: false, item: null, action: 'open' });
                setSelectedIds(new Set()); // Clear selection
                refresh();
            } else if (action === 'unlock') {
                await unlockNode(item.id, password);
                setUnlockModal({ isOpen: false, item: null, action: 'open' });
                refresh();
            }
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Access Denied', message: e.message });
        }
    };

    const handleContextAction = async (action: string, item?: APIFile | APIFolder) => {
        setContextMenu(null);

        switch (action) {
            case 'new-file':
                setCreateFileType('any');
                setIsCreateFileOpen(true);
                break;
            case 'new-txt':
                setCreateFileType('txt');
                setIsCreateFileOpen(true);
                break;
            case 'open':
                if (item) onDoubleClick(item);
                break;
            case 'preview':
                if (item && !isFolder(item)) setPreviewItem({ file: item as APIFile });
                break;
            case 'download':
                if (item) handleSecureDownload(item as APIFile);
                break;
            case 'extract':
                if (item && !isFolder(item)) handleExtract(item as APIFile);
                break;
            case 'compress':
                if (item && !isFolder(item)) handleCompress(item as APIFile);
                break;
            case 'rename':
                if (item) {
                    if (item.locked) {
                        setAlertModal({ isOpen: true, title: 'Action Denied', message: 'Cannot rename locked item.' });
                        return;
                    }
                    setSelectedIds(new Set([item.id]));
                    setRenameModal({ isOpen: true, id: item.id, name: item.name });
                }
                break;
            case 'lock':
                if (item) setLockModal({ isOpen: true, item });
                break;
            case 'unlock':
                if (item) {
                    setUnlockModal({ isOpen: true, item, action: 'unlock' });
                }
                break;
            case 'delete':
                if (item) {
                    if (!selectedIds.has(item.id)) {
                        setSelectedIds(new Set([item.id]));
                        setDeleteModal({ isOpen: true, count: 1 });
                    } else {
                        setDeleteModal({ isOpen: true, count: selectedIds.size });
                    }
                }
                break;
            case 'copy-link':
                if (item) {
                    const url = getDownloadUrl(item.id);
                    const absoluteUrl = url.startsWith('http') ? url : (window.location.origin + url);
                    navigator.clipboard.writeText(absoluteUrl).then(() => {
                        setAlertModal({ isOpen: true, title: 'Link Copied', message: 'Download link copied to clipboard!' });
                    });
                }
                break;

            // Background Actions
            case 'new-folder':
                setIsCreateOpen(true);
                break;
            case 'new-file':
                handleCreateNewFile('new_file.dat');
                break;
            case 'new-txt':
                handleCreateNewFile('note.txt');
                break;
            case 'refresh':
                refresh();
                break;
            case 'properties':
                handleShowProperties();
                break;
            case 'compress-current':
                setCompressModal({ isOpen: true, items: items.filter(i => !isFolder(i)) as APIFile[] });
                break;
        }
    };

    const handleCreateNewFile = async (defaultName: string) => {
        const name = prompt("Enter filename:", defaultName);
        if (!name) return;
        try {
            setUploadProgress({ name, percent: 0 });
            // Create a small placeholder file
            const blob = new Blob([" "], { type: 'text/plain' });
            const file = new File([blob], name);
            await uploadFile(currentPath, file, masterPassword || undefined, (p) => setUploadProgress({ name, percent: p }));
            refresh();
        } catch (e: any) {
            setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to create file: ' + e.message });
        } finally {
            setUploadProgress(null);
        }
    };

    const handleShowProperties = () => {
        const folderCount = items.filter(isFolder).length;
        const fileCount = items.length - folderCount;
        const totalSize = items.reduce((acc, item) => acc + (isFolder(item) ? 0 : (item as APIFile).size), 0);

        setAlertModal({
            isOpen: true,
            title: 'Folder Properties',
            message: `Current Folder: ${breadcrumbs[breadcrumbs.length - 1].name}\n\nFolders: ${folderCount}\nFiles: ${fileCount}\nTotal Size: ${formatSize(totalSize)}`
        });
    };

    // --- Box Selection Logic ---
    const handleMouseDown = (e: React.MouseEvent) => {
        // Ignore if clicking on buttons or interactive elements
        if ((e.target as HTMLElement).closest('button, input, a, .context-trigger, [data-selection-checkbox], [data-file-id]')) return;
        // Ignore if valid context menu click (usually handled by onContextMenu)
        if (e.button !== 0) return;

        setIsBoxSelecting(true);
        const start = { x: e.clientX, y: e.clientY };
        setSelectionStart(start);
        setSelectionCurrent(start);
        selectionRef.current.start = start;
        // Reset specific flag for click handling
        selectionRef.current.justFinishedSelection = false;

        // Clear selection if not holding modifier
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedIds(new Set());
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isBoxSelecting || !selectionRef.current.start) return;

        const current = { x: e.clientX, y: e.clientY };
        setSelectionCurrent(current);

        // Perform selection
        const start = selectionRef.current.start;
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);

        const newSelected = new Set(e.shiftKey || e.ctrlKey || e.metaKey ? selectedIds : []);

        // Find intersecting items
        // This relies on DOM elements having data-id attribute. 
        // We'll need to add data-id to file items.
        const itemElements = document.querySelectorAll('[data-file-id]');
        itemElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            // simple AABB collision
            if (
                left < rect.right &&
                left + width > rect.left &&
                top < rect.bottom &&
                top + height > rect.top
            ) {
                const id = el.getAttribute('data-file-id');
                if (id) newSelected.add(id);
            }
        });

        setSelectedIds(newSelected);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isBoxSelecting) {
            setIsBoxSelecting(false);

            // Calculate if this was a real selection or just a click
            const start = selectionRef.current.start;
            const end = { x: e.clientX, y: e.clientY };
            const dist = start ? Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) : 0;

            setSelectionStart(null);
            setSelectionCurrent(null);
            selectionRef.current.start = null;

            // Only mark as "just finished selection" if we actually moved the mouse significant distance
            // This prevents a simple click from being eaten by the box selection flag
            if (dist > 5) {
                selectionRef.current.justFinishedSelection = true;
                setTimeout(() => {
                    if (selectionRef.current) selectionRef.current.justFinishedSelection = false;
                }, 100);
            } else {
                selectionRef.current.justFinishedSelection = false;
            }
        }
    };

    // --- Drag & Drop ---

    const handleDragStart = (e: React.DragEvent, item: APIFile | APIFolder) => {
        // Auto select on drag? Maybe not if we want strict separation
        if (!selectedIds.has(item.id)) {
            // If dragging an unselected item, select it temporarily?
            setSelectedIds(new Set([item.id]));
        }
        e.dataTransfer.setData("text/nodeId", item.id);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
        e.preventDefault();
        setDragOverId(null);
        const sourceId = e.dataTransfer.getData("text/nodeId");
        if (!sourceId || sourceId === targetFolderId) return;

        try {
            // If dragging a selected item, move all selected items
            if (selectedIds.has(sourceId)) {
                for (const id of selectedIds) {
                    if (id !== targetFolderId) {
                        await handleMove(id, targetFolderId);
                    }
                }
            } else {
                await handleMove(sourceId, targetFolderId);
            }
            refresh();
        } catch (err: any) {
            setAlertModal({ isOpen: true, title: 'Move Failed', message: err.message });
        }
    };

    return (
        <div
            className="flex-1 flex flex-col bg-transparent relative"
            onDragEnter={handleGlobalDragEnter}
            onDragLeave={handleGlobalDragLeave}
            onDragOver={handleGlobalDragOver}
            onDrop={handleGlobalDrop}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={() => {
                // If we just finished a box selection, don't clear the selection
                if (selectionRef.current.justFinishedSelection) {
                    selectionRef.current.justFinishedSelection = false;
                    return;
                }

                setContextMenu(null);
                setFocusedId(null);
                // Should clicking empty space clear selection?
                if (!isSelectMode) setSelectedIds(new Set());
            }}
        >
            {/* Toolbar */}
            <div className="h-16 flex items-center px-4 md:px-6 space-x-2 md:space-x-4 bg-transparent shadow-[0_2px_15px_rgba(255,255,255,0.05)] sticky top-0 z-30">
                <div className="flex-1 overflow-hidden flex items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); goUp(); }}
                        disabled={breadcrumbs.length <= 1}
                        className={`p-2 mr-2 rounded-full transition-colors ${breadcrumbs.length <= 1
                            ? "text-zinc-600 cursor-not-allowed opacity-50"
                            : "text-zinc-400 hover:bg-white/10 hover:text-white"
                            }`}
                        title="Go Back"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsRefreshing(true);
                            refresh();
                            setTimeout(() => setIsRefreshing(false), 600);
                        }}
                        className="p-2 mr-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-all group"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={`transition-transform group-hover:rotate-45 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                {/* Selection Controls */}
                <button
                    onClick={(e) => { e.stopPropagation(); setIsSelectMode(!isSelectMode); }}
                    className={`p-2 rounded-xl transition-all ${isSelectMode ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:text-white"}`}
                    title="Toggle Selection Mode"
                >
                    <CheckSquare size={18} />
                </button>

                {selectedIds.size > 0 ? (
                    <div className="flex items-center space-x-2 animate-fade-in bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-white/5" onClick={e => e.stopPropagation()}>
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
                        <label className="glass-button px-4 py-2 rounded-xl text-zinc-200 hover:text-white text-sm font-medium flex items-center space-x-2 cursor-pointer shadow-lg shadow-purple-900/10" onClick={e => e.stopPropagation()}>
                            <UploadCloud size={18} className="text-purple-400" />
                            <span className="hidden md:inline">Upload</span>
                            <input type="file" multiple className="hidden" onChange={onUpload} disabled={!!uploadProgress} />
                        </label>
                    </>
                )}


                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                <button
                    onClick={(e) => { e.stopPropagation(); toggleViewMode(); }}
                    className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
                    title={viewMode === 'list' ? "Switch to Grid View" : "Switch to List View"}
                >
                    {viewMode === 'list' ? <LayoutGrid size={18} /> : <List size={18} />}
                </button>

                <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

                <button
                    onClick={logout}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-full text-zinc-400 transition-all"
                    title="Lock Vault"
                >
                    <Lock size={18} />
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
            <div
                className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth"
                onContextMenu={onBackgroundContextMenu}
            >
                {isLoading && <FileSkeleton viewMode={viewMode} />}

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
                        {viewMode === 'list' ? (
                            <>
                                {/* Header Row */}
                                <div className="grid grid-cols-[auto_auto_1fr_auto_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-semibold uppercase text-zinc-500 tracking-wider mb-2 border-b border-white/5 items-center">
                                    <div className="w-6 flex justify-center">
                                        {isSelectMode && (
                                            <button onClick={(e) => { e.stopPropagation(); selectAll(); }} className="text-zinc-500 hover:text-white transition-colors">
                                                {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                        )}
                                    </div>
                                    <div className="w-8"></div>
                                    <div className="cursor-pointer hover:text-zinc-300 transition-colors flex items-center" onClick={() => toggleSort('name')}>
                                        Name <SortIcon column="name" />
                                    </div>
                                    <div className="w-24 hidden md:block">Type</div>
                                    <div className="w-20 md:w-24 text-right md:text-left cursor-pointer hover:text-zinc-300 transition-colors flex items-center justify-end md:justify-start" onClick={() => toggleSort('size')}>
                                        Size <SortIcon column="size" />
                                    </div>
                                    <div className="w-24 hidden md:block cursor-pointer hover:text-zinc-300 transition-colors flex items-center" onClick={() => toggleSort('date')}>
                                        Modified <SortIcon column="date" />
                                    </div>
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
                                        const isFocused = focusedId === item.id;
                                        const isDir = isFolder(item);
                                        return (
                                            <div
                                                key={item.id}
                                                data-file-id={item.id} // Add for box selection
                                                onClick={(e) => {
                                                    e.stopPropagation();

                                                    // 1. If Select Mode or Ctrl Key -> Toggle Selection
                                                    if (isSelectMode || e.ctrlKey || e.metaKey) {
                                                        toggleSelection(item.id, true);
                                                        setFocusedId(null);
                                                    } else {
                                                        // 2. Normal Click -> Focus Item, Clear Selection
                                                        setFocusedId(item.id);
                                                        if (selectedIds.size > 0) setSelectedIds(new Set());
                                                    }
                                                }}
                                                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(item); }}
                                                onContextMenu={(e) => onRightClick(e, item)}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item)}
                                                onDragOver={(e) => {
                                                    if (isDir) {
                                                        e.preventDefault();
                                                        setDragOverId(item.id);
                                                    }
                                                }}
                                                onDragLeave={() => setDragOverId(null)}
                                                onDrop={(e) => {
                                                    if (isDir) handleDrop(e, item.id);
                                                }}
                                                className={`group grid grid-cols-[auto_auto_1fr_auto_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200 border
                                                    ${isSel
                                                        ? "bg-black shadow-[0_0_15px_rgba(59,130,246,0.15)] border-white/20"
                                                        : isFocused
                                                            ? "bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.05)] border-white/10"
                                                            : dragOverId === item.id
                                                                ? "bg-blue-500/20 scale-[1.01] ring-1 ring-blue-400/50 border-transparent"
                                                                : "hover:bg-white/5 border-transparent"
                                                    }`}
                                            >
                                                <div className="w-6 flex justify-center">
                                                    <div
                                                        data-selection-checkbox // Fix: Prevent box selection clear
                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer z-10 
                                                            ${isSel
                                                                ? "bg-blue-500 border-blue-500"
                                                                : "border-zinc-700 hover:border-zinc-500 bg-black/40"
                                                            } 
                                                            ${!isSel && !isSelectMode && !isFocused ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelection(item.id, true);
                                                        }}
                                                    >
                                                        {isSel && <Check size={12} className="text-white" />}
                                                    </div>
                                                </div>

                                                <div className="w-8 flex justify-center relative">
                                                    {isDir ? (
                                                        item.type === 'drive' ? (
                                                            <HardDrive size={20} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                                                        ) : (
                                                            <FolderIcon size={20} className="text-yellow-500/80 group-hover:text-yellow-400 transition-colors" />
                                                        )
                                                    ) : (
                                                        getFileIcon((item as APIFile).name)
                                                    )}
                                                    {item.locked && (
                                                        <div className="absolute -top-1 right-0 bg-zinc-900 rounded-full p-0.5 border border-zinc-700 shadow-md">
                                                            <Lock size={8} className="text-red-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`font-medium truncate ${isSel ? "text-blue-100" : isFocused ? "text-white" : "text-zinc-300 group-hover:text-white"}`}>
                                                    {item.name}
                                                </div>
                                                <div className="w-24 text-sm text-zinc-500 hidden md:block">{isDir ? (item.type === 'drive' ? 'Drive' : 'Folder') : 'File'}</div>
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
                            </>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {filteredItems.length === 0 && (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-600">
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
                                    const isFocused = focusedId === item.id;
                                    const isDir = isFolder(item);
                                    return (
                                        <div
                                            key={item.id}
                                            data-file-id={item.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isSelectMode || e.ctrlKey || e.metaKey) {
                                                    toggleSelection(item.id, true);
                                                    setFocusedId(null);
                                                } else {
                                                    setFocusedId(item.id);
                                                    if (selectedIds.size > 0) setSelectedIds(new Set());
                                                }
                                            }}
                                            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(item); }}
                                            onContextMenu={(e) => onRightClick(e, item)}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item)}
                                            onDragOver={(e) => {
                                                if (isDir) {
                                                    e.preventDefault();
                                                    setDragOverId(item.id);
                                                }
                                            }}
                                            onDragLeave={() => setDragOverId(null)}
                                            onDrop={(e) => { if (isDir) handleDrop(e, item.id); }}
                                            className={`group flex flex-col items-center p-4 rounded-2xl cursor-pointer select-none transition-all duration-200 relative border
                                                ${isSel
                                                    ? "bg-black shadow-[0_0_20px_rgba(59,130,246,0.15)] border-white/20"
                                                    : isFocused
                                                        ? "bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.05)] border-white/10"
                                                        : dragOverId === item.id
                                                            ? "bg-blue-500/20 scale-[1.05] ring-2 ring-blue-400/50 border-transparent"
                                                            : "hover:bg-white/5 border-transparent"
                                                }`}
                                        >
                                            <div className="absolute top-3 left-3">
                                                <div
                                                    data-selection-checkbox // Fix: Prevent box selection clear
                                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer z-10 
                                                        ${isSel
                                                            ? "bg-blue-500 border-blue-500"
                                                            : "border-zinc-700 hover:border-zinc-500 bg-black/40"
                                                        } 
                                                        ${!isSel && !isSelectMode && !isFocused ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelection(item.id, true);
                                                    }}
                                                >
                                                    {isSel && <Check size={12} className="text-white" />}
                                                </div>
                                            </div>

                                            <div className="mb-3 relative">
                                                {isDir ? (
                                                    item.type === 'drive' ? (
                                                        <HardDrive size={48} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                                                    ) : (
                                                        <FolderIcon size={48} className="text-yellow-500/80 group-hover:text-yellow-400 transition-colors" />
                                                    )
                                                ) : (
                                                    <div className="w-12 h-12 flex items-center justify-center">
                                                        {React.cloneElement(getFileIcon((item as APIFile).name) as any, { size: 40 })}
                                                    </div>
                                                )}
                                                {item.locked && (
                                                    <div className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-1 border border-zinc-700 shadow-md">
                                                        <Lock size={12} className="text-red-400" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`text-sm font-medium text-center truncate w-full ${isSel ? "text-blue-100" : isFocused ? "text-white" : "text-zinc-300 group-hover:text-white"}`}>
                                                {item.name}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 mt-1">
                                                {isDir ? 'Folder' : formatSize((item as APIFile).size)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Drag Box Overlay */}
            {isBoxSelecting && <SelectionBox start={selectionStart} current={selectionCurrent} />}

            {/* Lock/Unlock Modals */}
            <InputModal
                isOpen={lockModal.isOpen}
                onClose={() => setLockModal({ isOpen: false, item: null })}
                onSubmit={handleLockSubmit}
                title={`Lock ${lockModal.item?.name}`}
                placeholder="Enter password"
                type="password"
            />

            <InputModal
                isOpen={unlockModal.isOpen}
                onClose={() => setUnlockModal({ isOpen: false, item: null, action: 'open' })}
                onSubmit={handleUnlockSubmit}
                title={`Unlock ${unlockModal.item?.name}`}
                placeholder="Enter password to access"
                type="password"
            />

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onClose={() => setContextMenu(null)}
                    onAction={(action) => handleContextAction(action, contextMenu.item)}
                    type={contextMenu.type || 'item'}
                />
            )}

            {/* Modals */}

            {/* Creation Modals */}
            <InputModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSubmit={handleCreateSubmit}
                title="Create New Folder"
                placeholder="Folder Name"
                submitLabel="Create Folder"
            />
            <InputModal
                isOpen={isCreateFileOpen}
                onClose={() => setIsCreateFileOpen(false)}
                onSubmit={handleCreateFileSubmit}
                title={createFileType === 'txt' ? "New Text Document" : "Create New File"}
                placeholder={createFileType === 'txt' ? "filename" : "filename.txt"}
                submitLabel={createFileType === 'txt' ? "Create Text File" : "Create File"}
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

            {/* Premium Modals */}
            <CompressModal
                isOpen={compressModal.isOpen}
                onClose={() => setCompressModal({ ...compressModal, isOpen: false })}
                onCompress={performCompression}
                fileCount={compressModal.items.length}
            />

            {/* Text Editor Modal */}
            {textEditor.isOpen && textEditor.file && (
                <TextEditorModal
                    isOpen={textEditor.isOpen}
                    onClose={() => setTextEditor({ isOpen: false, file: null, content: '' })}
                    onSave={handleEditorSave}
                    fileName={textEditor.file.name}
                    initialContent={textEditor.content}
                />
            )}

            {/* Rich Media Previewer */}
            {previewItem && (
                <PreviewModal
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    title={previewItem.file.name}
                    onDownload={() => handleSecureDownload(previewItem.file, previewItem.password)}
                    onExternal={() => handleSecureDownload(previewItem.file, previewItem.password)}
                >
                    <FilePreviewContent item={previewItem.file} lockPassword={previewItem.password} />
                </PreviewModal>
            )}

            {/* Branding Footer */}
            <div className="bg-transparent py-2 text-center text-[10px] text-zinc-600 font-medium select-none z-20 shadow-[0_-2px_15px_rgba(255,255,255,0.05)]">
                Made with <span className="inline-block animate-pulse text-red-500 mx-1" style={{ animation: 'beat 1.5s infinite' }}>❤️</span>
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
