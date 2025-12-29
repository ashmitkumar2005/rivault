"use client";

import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2, Download, ExternalLink } from 'lucide-react';
import { createPortal } from 'react-dom';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    onDownload?: () => void;
    onExternal?: () => void;
}

export default function PreviewModal({ isOpen, onClose, title, children, onDownload, onExternal }: PreviewModalProps) {
    const [mounted, setMounted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 md:p-8">
            {/* Backdrop with extreme blur and dark tint */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-fade-in"
                onClick={onClose}
            />

            {/* Content Container */}
            <div className={`relative w-full h-full flex flex-col bg-zinc-950/50 border border-white/5 shadow-2xl overflow-hidden animate-scale-in transition-all duration-300 ${isFullScreen ? 'max-w-none max-h-none rounded-0' : 'max-w-6xl max-h-[90vh] rounded-3xl'}`}>

                {/* Header - Glassy and floating */}
                <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center space-x-4">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                            <h3 className="text-sm md:text-base font-bold text-white truncate max-w-[200px] md:max-w-sm tracking-tight">{title}</h3>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {onExternal && (
                            <button
                                onClick={onExternal}
                                className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 backdrop-blur-md transition-all"
                                title="Open in New Tab"
                            >
                                <ExternalLink size={20} />
                            </button>
                        )}
                        {onDownload && (
                            <button
                                onClick={onDownload}
                                className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 backdrop-blur-md transition-all"
                                title="Download"
                            >
                                <Download size={20} />
                            </button>
                        )}
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 backdrop-blur-md transition-all hidden sm:flex"
                            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1" />
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl text-white bg-red-500/20 hover:bg-red-500 hover:text-white transition-all backdrop-blur-md"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body - Main Preview Area */}
                <div className="flex-1 flex items-center justify-center p-4 pt-20 overflow-auto custom-scrollbar">
                    {children}
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>,
        document.body
    );
}
