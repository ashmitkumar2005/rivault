"use client";

import React, { useState, useEffect } from 'react';
import { APIFile, getDownloadUrl, downloadAndDecryptFile } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { FileText, Music, Play, AlertCircle, Loader2, Archive, File as FileIcon, Download } from 'lucide-react';
import { listZipContents } from '@/lib/archive';

interface FilePreviewContentProps {
    item: APIFile;
    lockPassword?: string;
}

export default function FilePreviewContent({ item, lockPassword }: FilePreviewContentProps) {
    const { masterPassword } = useAuth();
    const [content, setContent] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [zipItems, setZipItems] = useState<string[]>([]);
    const ext = item.name.split('.').pop()?.toLowerCase() || '';

    useEffect(() => {
        let isStopped = false;

        const loadContent = async () => {
            setLoading(true);
            setError(null);
            try {
                const decryptedBlob = await downloadAndDecryptFile(item, masterPassword || undefined, lockPassword);
                if (isStopped) return;

                const url = window.URL.createObjectURL(decryptedBlob);
                setBlobUrl(url);

                const textExts = ['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'json', 'css', 'html', 'yaml', 'yml', 'xml', 'rs', 'go', 'cpp', 'c', 'sh'];
                if (textExts.includes(ext)) {
                    const text = await decryptedBlob.text();
                    if (!isStopped) setContent(text);
                }

                if (ext === 'zip') {
                    const items = await listZipContents(decryptedBlob);
                    if (!isStopped) setZipItems(items);
                }
            } catch (err: any) {
                if (!isStopped) setError(err.message);
            } finally {
                if (!isStopped) setLoading(false);
            }
        };

        loadContent();

        return () => {
            isStopped = true;
            if (blobUrl) {
                window.URL.revokeObjectURL(blobUrl);
            }
        };
    }, [item.id, masterPassword, lockPassword]);

    // Handle blobUrl cleanup specifically when it changes
    useEffect(() => {
        return () => {
            if (blobUrl) window.URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    // 1. Image Preview
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
        return (
            <div className="relative group animate-fade-in max-w-full max-h-full flex items-center justify-center">
                <img
                    src={blobUrl || ""}
                    alt={item.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-500 hover:scale-[1.02]"
                    onLoad={(e) => (e.currentTarget.parentElement?.classList.remove('animate-pulse'))}
                />
            </div>
        );
    }

    // 2. Video Preview
    if (['mp4', 'mkv', 'mov', 'webm'].includes(ext)) {
        return (
            <div className="w-full max-w-4xl aspect-video bg-black/40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
                <video
                    src={blobUrl || ""}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay
                />
            </div>
        );
    }

    // 3. Audio Preview
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
        return (
            <div className="w-full max-w-xl p-12 glass-panel rounded-[2rem] border border-white/10 flex flex-col items-center space-y-8 animate-scale-in">
                <div className="w-40 h-40 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center shadow-inner group relative">
                    <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity animate-pulse" />
                    <Music size={80} className="text-blue-400 relative z-10" />
                </div>
                <div className="text-center">
                    <h4 className="text-xl font-bold text-white mb-2">{item.name}</h4>
                    <p className="text-sm text-zinc-400">Audio Preview</p>
                </div>
                <audio src={blobUrl || ""} controls className="w-full" autoPlay />
            </div>
        );
    }

    // 4. ZIP Content Preview
    if (ext === 'zip' && zipItems.length > 0) {
        return (
            <div className="w-full max-w-2xl glass-panel rounded-3xl border border-white/10 overflow-hidden flex flex-col animate-scale-in">
                <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center space-x-3">
                    <div className="p-2 bg-amber-500/20 rounded-xl">
                        <Archive size={20} className="text-amber-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Archive Contents</h4>
                        <p className="text-[10px] text-zinc-500">{zipItems.length} items found</p>
                    </div>
                </div>
                <div className="flex-1 max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                    {zipItems.map((name, i) => (
                        <div key={i} className="flex items-center space-x-3 px-4 py-2 hover:bg-white/5 rounded-xl transition-colors group">
                            <FileIcon size={14} className="text-zinc-500 group-hover:text-zinc-300" />
                            <span className="text-xs text-zinc-300 group-hover:text-white truncate">{name}</span>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-zinc-950/30 text-center">
                    <p className="text-[10px] text-zinc-600 font-medium italic">Double-click or right-click to extract full archive</p>
                </div>
            </div>
        );
    }

    // 4. Code / Text Preview
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
                <Loader2 size={48} className="text-blue-400 animate-spin" />
                <p className="text-zinc-400 text-sm font-medium tracking-widest uppercase">Fetching Content...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 text-red-400">
                <AlertCircle size={48} />
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (content !== null) {
        return (
            <div className="w-full max-w-5xl h-full max-h-[70vh] glass-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{ext} Source</span>
                </div>
                <pre className="flex-1 p-6 overflow-auto custom-scrollbar text-sm font-mono text-zinc-300 selection:bg-blue-500/30">
                    <code className="block leading-relaxed">
                        {content}
                    </code>
                </pre>
            </div>
        );
    }

    // 5. Fallback for unsupported types
    return (
        <div className="flex flex-col items-center justify-center space-y-6 text-zinc-500 animate-scale-in">
            <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center border border-white/5">
                <FileText size={48} className="opacity-20" />
            </div>
            <div className="text-center">
                <h4 className="text-lg font-medium text-zinc-300">No Preview Available</h4>
                <p className="text-sm text-zinc-500 mt-1 max-w-[250px]">Preview for this file type is not supported yet, or decryption failed.</p>
            </div>
            {blobUrl && (
                <a
                    href={blobUrl}
                    download={item.name}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center space-x-2"
                >
                    <Download size={16} />
                    <span>Download Decrypted</span>
                </a>
            )}
        </div>
    );
}
