import React from 'react';
import { ArrowLeft, RefreshCw, Search, CheckSquare, UploadCloud, Edit2, Trash2, LayoutGrid, List, Lock } from 'lucide-react';
import Breadcrumb from "@/components/Breadcrumb";

export interface ToolbarProps {
    breadcrumbs: any[];
    navigateToBreadcrumb: (index: number) => void;
    goUp: () => void;
    refresh: () => void;
    isRefreshing: boolean;
    setIsRefreshing: (val: boolean) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    isSelectMode: boolean;
    setIsSelectMode: (val: boolean) => void;
    selectedIds: Set<string>;
    initiateRename: () => void;
    initiateDelete: () => void;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadProgress: any;
    viewMode: string;
    toggleViewMode: () => void;
    logout: () => void;
}

export default function Toolbar({
    breadcrumbs,
    navigateToBreadcrumb,
    goUp,
    refresh,
    isRefreshing,
    setIsRefreshing,
    searchQuery,
    setSearchQuery,
    isSelectMode,
    setIsSelectMode,
    selectedIds,
    initiateRename,
    initiateDelete,
    onUpload,
    uploadProgress,
    viewMode,
    toggleViewMode,
    logout
}: ToolbarProps) {
    return (
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
    );
}
