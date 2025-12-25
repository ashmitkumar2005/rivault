"use client";

import React, { useState } from "react";
import { APIFolder, listFolder, isFolder } from "@/lib/api";
import { useFileSystem, FileType } from "@/components/providers/FileSystemProvider";
import { ChevronRight, Folder, FolderOpen, HardDrive, PieChart, Image as ImageIcon, Video, Music, FileText } from "lucide-react";
import Image from "next/image";

// Recursive Node
function FolderNode({ folder, depth = 0 }: { folder: APIFolder; depth?: number }) {
    const { currentPath, navigateTo } = useFileSystem();
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<APIFolder[]>([]);
    const [loaded, setLoaded] = useState(false);

    const isActive = currentPath === folder.id;

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && !loaded) {
            try {
                const nodes = await listFolder(folder.id);
                setChildren(nodes.filter(isFolder));
                setLoaded(true);
            } catch (err) {
                console.error("Failed to load children", err);
            }
        }
        setIsOpen(!isOpen);
    };

    const handleClick = () => {
        navigateTo(folder.id, folder.name);
    };

    return (
        <div className="select-none animate-fade-in">
            <div
                className={`group flex items-center py-2 px-3 cursor-pointer rounded-lg mx-2 transition-all duration-200 ${isActive
                    ? "bg-blue-600/20 text-blue-200 border border-blue-500/20"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                style={{ paddingLeft: `${depth * 12 + 12}px` }}
                onClick={handleClick}
            >
                <div className="flex items-center min-w-[20px] justify-center mr-1">
                    <button
                        onClick={handleToggle}
                        className={`p-0.5 rounded-md hover:bg-white/10 transition-colors ${isOpen ? "text-zinc-300" : "text-zinc-500"}`}
                    >
                        <ChevronRight
                            size={14}
                            className={`transform transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                        />
                    </button>
                </div>

                {/* Folder Icon */}
                <span className={`mr-2.5 transition-colors ${isActive ? "text-blue-400" : "text-yellow-500/80 group-hover:text-yellow-400"}`}>
                    {isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}
                </span>

                <span className="truncate text-sm font-medium tracking-wide">{folder.name}</span>
            </div>

            {isOpen && (
                <div className="relative">
                    {/* Tree Guide Line */}
                    <div
                        className="absolute top-0 bottom-2 w-px bg-white/5"
                        style={{ left: `${depth * 12 + 21}px` }}
                    />

                    {children.map(child => (
                        <FolderNode key={child.id} folder={child} depth={depth + 1} />
                    ))}
                    {children.length === 0 && loaded && (
                        <div style={{ paddingLeft: `${(depth + 1) * 12 + 36}px` }} className="py-2 text-xs text-zinc-600 italic">
                            Empty Folder
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


export default function Sidebar() {
    // Root is special.
    const rootFolder: APIFolder = { id: 'root', parentId: '', name: 'My Drive', createdAt: 0 };
    const { storageUsage, fileTypeFilter, setFileTypeFilter } = useFileSystem();

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const FilterButton = ({ type, icon, label, count }: { type: FileType, icon: React.ReactNode, label: string, count: string }) => {
        const isActive = fileTypeFilter === type;
        return (
            <button
                onClick={() => setFileTypeFilter(isActive ? 'all' : type)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-sm group ${isActive
                    ? "bg-blue-600/20 text-blue-200 border border-blue-500/20"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
            >
                <div className="flex items-center space-x-3">
                    <span className={isActive ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400"}>{icon}</span>
                    <span className="font-medium">{label}</span>
                </div>
            </button>
        );
    };

    return (
        <div className="w-64 glass-panel border-r-0 border-r-white/5 flex flex-col h-full z-20 shadow-2xl backdrop-blur-xl bg-black/40">
            <div className="p-6 pb-2 flex items-center mb-4">
                <div className="relative w-9 h-9 mr-3 group">
                    <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                    <Image src="/logo.svg" alt="Rivault Logo" fill className="object-contain relative z-10" />
                </div>
                <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 text-xl tracking-tight">Rivault</span>
            </div>

            <div className="flex-1 overflow-y-auto px-1 py-2 scroll-smooth">
                <div className="flex items-center space-x-2 px-4 mb-3 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    <HardDrive size={12} />
                    <span>Locations</span>
                </div>
                <FolderNode folder={rootFolder} />
            </div>

            {/* File Type Filters TEMP SECTION - Ideally this would be searchable tags or such */}
            <div className="px-4 py-2 border-t border-white/5">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">File Types</div>
                <div className="space-y-1">
                    <FilterButton type="image" icon={<ImageIcon size={16} />} label="Images" count="JPG, PNG..." />
                    <FilterButton type="video" icon={<Video size={16} />} label="Videos" count="MP4, MKV..." />
                    <FilterButton type="audio" icon={<Music size={16} />} label="Music" count="MP3, WAV..." />
                    <FilterButton type="document" icon={<FileText size={16} />} label="Documents" count="PDF, DOC..." />
                </div>
            </div>

            <div className="p-4 mx-2 mb-2 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <div className="flex items-center space-x-2">
                        <PieChart size={14} className="text-blue-400" />
                        <span>Storage Used</span>
                    </div>
                </div>
                <div className="flex items-end justify-between">
                    <span className="text-xl font-bold text-white">{formatSize(storageUsage)}</span>
                    <span className="text-[10px] text-zinc-500 font-mono mb-1">UNLIMITED</span>
                </div>
            </div>
        </div>
    );
}
