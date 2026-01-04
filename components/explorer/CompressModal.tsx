"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Archive, Lock, Gauge, FileType } from 'lucide-react';

interface CompressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCompress: (name: string, level: number, password?: string) => void;
    fileCount: number;
}

export default function CompressModal({ isOpen, onClose, onCompress, fileCount }: CompressModalProps) {
    const [name, setName] = useState(`Archive_${new Date().getTime()}.zip`);
    const [level, setLevel] = useState<number>(6); // Default 6 (Deflate)
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCompress(name, level, password || undefined);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md bg-zinc-900/40 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 rounded-3xl shadow-2xl animate-scale-in overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-amber-500/20 rounded-xl">
                            <Archive size={20} className="text-amber-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Compress {fileCount} Files</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Archive Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
                            <FileType size={14} />
                            <span>Archive Name</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                            required
                        />
                    </div>

                    {/* Compression Level */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
                            <Gauge size={14} />
                            <span>Compression Level</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { val: 0, label: 'Store (No Comp)' },
                                { val: 6, label: 'Fast (Deflate)' },
                                { val: 9, label: 'Best (Smallest)' }
                            ].map((opt) => (
                                <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => setLevel(opt.val)}
                                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${level === opt.val
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                        : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
                            <Lock size={14} />
                            <span>Password (Optional)</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password..."
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                        />
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-sm font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-900/20 transition-all"
                        >
                            Compress
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
