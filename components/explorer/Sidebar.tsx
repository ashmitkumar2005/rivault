import React, { useState } from "react";
import { APIFolder, listFolder, isFolder } from "@/lib/api";
import { useFileSystem, FileType } from "@/components/providers/FileSystemProvider";
import { ChevronRight, Folder, FolderOpen, HardDrive, PieChart, Image as ImageIcon, Video, Music, FileText, ChevronLeft, Plus, Server } from "lucide-react";
import Image from "next/image";
import AddDriveModal from "./AddDriveModal";

// Recursive Node
function FolderNode({ folder, depth = 0, isCollapsed }: { folder: APIFolder; depth?: number; isCollapsed: boolean }) {
    const { currentPath, navigateTo } = useFileSystem();
    const [isOpen, setIsOpen] = useState(depth === 0); // Open root by default
    const [children, setChildren] = useState<APIFolder[]>([]);
    const [loaded, setLoaded] = useState(false);

    const isActive = currentPath === folder.id;
    const isDrive = folder.type === 'drive';
    const isSystemRoot = depth === 0 && folder.id === 'root';

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

    // Calculate usage percentage if drive
    const usagePercent = isDrive && folder.quota && folder.usage
        ? Math.min(100, (folder.usage / folder.quota) * 100)
        : 0;

    return (
        <div className="select-none animate-fade-in group/node">
            <div
                className={`group flex items-center py-2 px-2 ${!isCollapsed ? 'md:px-3' : ''} cursor-pointer rounded-lg mx-1 ${!isCollapsed ? 'md:mx-2' : ''} transition-all duration-200 justify-center ${!isCollapsed ? 'md:justify-start' : ''} ${isActive
                    ? "bg-blue-600/20 text-blue-200 border border-blue-500/20"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                style={{ paddingLeft: (typeof window !== 'undefined' && window.innerWidth >= 768 && !isCollapsed) ? `${depth * 12 + 12}px` : undefined }}
                onClick={handleClick}
                title={isCollapsed ? folder.name : undefined}
            >
                {!isCollapsed && (
                    <div className="hidden md:flex items-center min-w-[20px] justify-center mr-1">
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
                )}

                {/* Icon Logic */}
                <span className={`transition-colors ${!isCollapsed ? 'md:mr-2.5' : ''} ${isActive ? "text-blue-400" : isDrive ? "text-purple-400" : isSystemRoot ? "text-zinc-100" : "text-yellow-500/80 group-hover:text-yellow-400"}`}>
                    {isSystemRoot ? (
                        <Server size={20} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />
                    ) : isDrive ? (
                        <HardDrive size={20} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />
                    ) : isOpen ? (
                        <FolderOpen size={20} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />
                    ) : (
                        <Folder size={20} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />
                    )}
                </span>

                {!isCollapsed && (
                    <div className="hidden md:block flex-1 min-w-0">
                        <div className="truncate text-sm font-medium tracking-wide animate-fade-in">{folder.name}</div>
                        {isDrive && folder.quota && (
                            <div className="mt-1 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${usagePercent > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                                    style={{ width: `${usagePercent}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isOpen && !isCollapsed && (
                <div className="relative">
                    <div
                        className={`hidden md:block absolute top-0 bottom-2 w-px bg-white/5 ${isCollapsed ? 'hidden' : ''}`}
                        style={{ left: `${depth * 12 + 21}px` }}
                    />
                    {children.map(child => (
                        <FolderNode key={child.id} folder={child} depth={depth + 1} isCollapsed={isCollapsed} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Sidebar() {
    const { storageUsage, fileTypeFilter, setFileTypeFilter } = useFileSystem();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isAddDriveOpen, setIsAddDriveOpen] = useState(false);
    const [drives, setDrives] = useState<APIFolder[]>([]);

    const fetchDrives = async () => {
        try {
            const nodes = await listFolder('root');
            setDrives(nodes.filter(isFolder));
        } catch (e) {
            console.error("Failed to load drives", e);
        }
    };

    React.useEffect(() => {
        fetchDrives();
    }, []);

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
                className={`w-full flex items-center justify-center ${!isCollapsed ? 'md:justify-between px-2 md:px-3' : ''} py-2 rounded-lg transition-all text-sm group ${isActive
                    ? "bg-blue-600/20 text-blue-200 border border-blue-500/20"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                title={isCollapsed ? label : label}
            >
                <div className={`flex items-center ${!isCollapsed ? 'md:space-x-3' : 'justify-center w-full'}`}>
                    <span className={isActive ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400"}>{icon}</span>
                    {!isCollapsed && <span className="hidden md:block font-medium">{label}</span>}
                </div>
            </button>
        );
    };

    return (
        <div
            className={`w-16 ${isCollapsed ? 'md:w-16' : 'md:w-64'} flex flex-col h-full z-20 shadow-[0_0_20px_rgba(255,255,255,0.08)] backdrop-blur-xl bg-transparent transition-all duration-300 relative group/sidebar`}
        >
            {/* Collapse Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-8 w-6 h-6 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all shadow-lg z-50 opacity-0 group-hover/sidebar:opacity-100"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Logo Section */}
            <div className={`p-4 ${!isCollapsed ? 'md:p-6' : ''} pb-2 flex items-center justify-center ${!isCollapsed ? 'md:justify-start' : ''} mb-4`}>
                <div className={`relative w-8 h-8 ${!isCollapsed ? 'md:w-9 md:h-9 md:mr-3' : ''} group shrink-0`}>
                    <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                    <Image src="/logo.svg" alt="Rivault Logo" fill className="object-contain relative z-10" />
                </div>
                {!isCollapsed && (
                    <span className="hidden md:block font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 text-xl tracking-tight animate-fade-in">
                        Rivault
                    </span>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-1 py-2 scroll-smooth">
                {/* Locations Header - Mobile Icon Only */}
                <div className={`flex items-center justify-between ${!isCollapsed ? 'md:justify-between space-x-0 md:space-x-2' : 'justify-center'} px-2 ${!isCollapsed ? 'md:px-4' : ''} mb-3`}>
                    <div className="flex items-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        <HardDrive size={16} className={`${!isCollapsed ? 'md:w-3 md:h-3 md:mr-2' : ''}`} />
                        {!isCollapsed && <span className="hidden md:block animate-fade-in">Locations</span>}
                    </div>
                    {!isCollapsed && (
                        <button
                            onClick={() => setIsAddDriveOpen(true)}
                            className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-white transition-colors"
                            title="Add New Drive"
                        >
                            <Plus size={14} />
                        </button>
                    )}
                </div>

                {drives.map(drive => (
                    <FolderNode key={drive.id} folder={drive} isCollapsed={isCollapsed} />
                ))}
            </div>

            {/* File Type Filters */}
            <div className={`px-2 ${!isCollapsed ? 'md:px-4' : ''} py-2`}>
                {!isCollapsed && <div className="hidden md:block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 animate-fade-in">File Types</div>}
                {/* Mobile Separator */}
                <div className={`${!isCollapsed ? 'md:hidden' : 'block'} h-px bg-white/0 my-2 mx-2`} />

                <div className="space-y-1">
                    <FilterButton type="image" icon={<ImageIcon size={18} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />} label="Images" count="JPG, PNG..." />
                    <FilterButton type="video" icon={<Video size={18} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />} label="Videos" count="MP4, MKV..." />
                    <FilterButton type="audio" icon={<Music size={18} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />} label="Music" count="MP3, WAV..." />
                    <FilterButton type="document" icon={<FileText size={18} className={`${!isCollapsed ? 'md:w-4 md:h-4' : ''}`} />} label="Documents" count="PDF, DOC..." />
                </div>
            </div>

            {/* Storage Section */}
            <div className={`p-2 ${!isCollapsed ? 'md:p-4 mx-1 md:mx-2' : 'mx-1'} mb-2 rounded-xl bg-blue-500/5`}>
                <div className={`flex items-center justify-center ${!isCollapsed ? 'md:justify-between' : ''} text-xs text-zinc-400 mb-0 md:mb-2`}>
                    <div className={`flex items-center ${!isCollapsed ? 'md:space-x-2' : ''}`}>
                        <PieChart size={16} className={`text-blue-400 ${!isCollapsed ? 'md:w-3.5 md:h-3.5' : ''}`} />
                        {!isCollapsed && <span className="hidden md:inline animate-fade-in">Storage Used</span>}
                    </div>
                </div>
                {!isCollapsed && (
                    <div className="hidden md:flex items-end justify-between animate-fade-in">
                        <span className="text-xl font-bold text-white">{formatSize(storageUsage)}</span>
                        <span className="text-[10px] text-zinc-500 font-mono mb-1">AGGREGATE</span>
                    </div>
                )}
                <div className={`${!isCollapsed ? 'md:hidden' : 'block'} text-[10px] text-zinc-400 text-center mt-1`}>
                    {formatSize(storageUsage)}
                </div>
            </div>

            <AddDriveModal
                isOpen={isAddDriveOpen}
                onClose={() => setIsAddDriveOpen(false)}
                onSuccess={() => {
                    fetchDrives(); // Refresh list logic
                    // Also trigger global refresh if possible, but drives list is local state here
                }}
            />
        </div>
    );
}
