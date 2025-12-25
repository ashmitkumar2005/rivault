"use client";

import React, { useEffect, useRef } from "react";
import { APIFile, APIFolder, isFolder } from "@/lib/api";
import {
    FolderOpen, Download, Edit2, Trash2, ExternalLink
} from "lucide-react";

interface ContextMenuProps {
    x: number;
    y: number;
    item: APIFile | APIFolder;
    onClose: () => void;
    onAction: (action: string, item: APIFile | APIFolder) => void;
}

export default function ContextMenu({ x, y, item, onClose, onAction }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    // Prevent menu from going off-screen (basic simple clamp)
    const style = {
        top: Math.min(y, window.innerHeight - 250),
        left: Math.min(x, window.innerWidth - 200),
    };

    const isDir = isFolder(item);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-56 glass-panel rounded-xl shadow-2xl animate-scale-in overflow-hidden flex flex-col p-1 border border-white/10"
            style={style}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="px-3 py-2 border-b border-white/5 mb-1 bg-white/5">
                <p className="text-xs font-semibold text-zinc-300 truncate max-w-[180px]">{item.name}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{isDir ? 'Folder' : 'File'}</p>
            </div>

            <button
                onClick={() => onAction('open', item)}
                className="flex items-center space-x-3 px-3 py-2 text-sm text-zinc-200 hover:bg-blue-600/20 hover:text-blue-200 rounded-lg transition-colors group"
            >
                {isDir ? <FolderOpen size={16} className="text-zinc-400 group-hover:text-blue-400" /> : <ExternalLink size={16} className="text-zinc-400 group-hover:text-blue-400" />}
                <span>Open</span>
            </button>

            {!isDir && (
                <button
                    onClick={() => onAction('download', item)}
                    className="flex items-center space-x-3 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 rounded-lg transition-colors group"
                >
                    <Download size={16} className="text-zinc-400 group-hover:text-white" />
                    <span>Download</span>
                </button>
            )}

            <div className="h-px bg-white/5 my-1 mx-2" />

            <button
                onClick={() => onAction('rename', item)}
                className="flex items-center space-x-3 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 rounded-lg transition-colors group"
            >
                <Edit2 size={16} className="text-zinc-400 group-hover:text-zinc-200" />
                <span>Rename</span>
            </button>

            <button
                onClick={() => onAction('delete', item)}
                className="flex items-center space-x-3 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-lg transition-colors group"
            >
                <Trash2 size={16} className="text-red-400 group-hover:text-red-300" />
                <span>Delete</span>
            </button>
        </div>
    );
}
