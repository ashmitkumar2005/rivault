import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Save, FileText, RotateCcw, RotateCw, AlignLeft, WrapText, ZoomIn, ZoomOut, Search, Check } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal'; // Ensure this path is correct
import Image from 'next/image';

interface TextEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string) => Promise<void>;
    fileName: string;
    initialContent: string;
}

export function TextEditorModal({ isOpen, onClose, onSave, fileName, initialContent }: TextEditorModalProps) {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null); // Store monaco instance
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaved, setIsSaved] = useState(false); // Track if successfully saved
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Editor State
    const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
    const [fontSize, setFontSize] = useState(14);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isDirty]);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Define transparent theme
        monaco.editor.defineTheme('transparent-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#00000000', // Transparent
                'minimap.background': '#00000000',
            }
        });

        monaco.editor.setTheme('transparent-dark');

        // Add save action to command palette / keyboard shortcut within editor context too helpfully
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            handleSave();
        });

        editor.focus();
    };

    const handleSave = async () => {
        if (!editorRef.current) return;
        setIsSaving(true);
        try {
            const value = editorRef.current.getValue();
            await onSave(value);
            setIsDirty(false);
            setIsSaved(true); // Mark as saved
        } catch (error) {
            console.error("Failed to save:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleContentChange = () => {
        if (!isDirty) setIsDirty(true);
        if (isSaved) setIsSaved(false); // Revert "Saved" state on edit
    };

    const handleClose = () => {
        if (isDirty) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    };

    const confirmClose = () => {
        setShowCloseConfirm(false);
        setIsDirty(false);
        onClose();
    };

    // Editor Actions
    const handleUndo = () => editorRef.current?.trigger('source', 'undo', {});
    const handleRedo = () => editorRef.current?.trigger('source', 'redo', {});
    const handleFormat = () => editorRef.current?.getAction('editor.action.formatDocument').run();
    const handleFind = () => editorRef.current?.getAction('actions.find').run();

    const toggleWordWrap = () => setWordWrap(prev => prev === 'on' ? 'off' : 'on');
    const zoomIn = () => setFontSize(prev => Math.min(prev + 2, 32));
    const zoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));

    if (!isOpen) return null;

    // Determine language from extension
    const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
    let language = 'plaintext';
    switch (ext) {
        case 'js': language = 'javascript'; break;
        case 'ts': language = 'typescript'; break;
        case 'jsx': language = 'javascript'; break;
        case 'tsx': language = 'typescript'; break;
        case 'json': language = 'json'; break;
        case 'html': language = 'html'; break;
        case 'css': language = 'css'; break;
        case 'md': language = 'markdown'; break;
        case 'py': language = 'python'; break;
        case 'java': language = 'java'; break;
        case 'c': language = 'c'; break;
        case 'cpp': language = 'cpp'; break;
        case 'sql': language = 'sql'; break;
        // add more as needed
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
            <div className="w-full h-full md:w-[90vw] md:h-[90vh] bg-zinc-900/30 backdrop-blur-xl md:rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden ring-1 ring-white/5">
                {/* Header */}
                <div className="h-12 bg-white/5 backdrop-blur-md flex items-center justify-between px-4 border-b border-white/10 select-none">
                    <div className="flex items-center space-x-3">
                        <FileText size={18} className="text-blue-400" />
                        <span className="text-sm font-medium text-zinc-200">{fileName}</span>
                        {isDirty && <span className="text-xs text-zinc-500 italic ml-2">● Edited</span>}
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isSaved}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSaved
                                    ? 'bg-green-600/20 text-green-400 border border-green-600/30 cursor-default'
                                    : isSaving
                                        ? 'text-zinc-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                }`}
                        >
                            {isSaved ? <Check size={14} /> : <Save size={14} className={isSaving ? "animate-spin" : ""} />}
                            <span>{isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}</span>
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-2" />
                        <button
                            onClick={handleClose}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="h-10 bg-white/5 backdrop-blur-md flex items-center px-4 border-b border-white/10 space-x-1 select-none overflow-x-auto">
                    <ToolbarButton icon={<RotateCcw size={14} />} onClick={handleUndo} title="Undo (Ctrl+Z)" />
                    <ToolbarButton icon={<RotateCw size={14} />} onClick={handleRedo} title="Redo (Ctrl+Y)" />
                    <div className="w-px h-4 bg-white/10 mx-2" />
                    <ToolbarButton icon={<Search size={14} />} onClick={handleFind} title="Find (Ctrl+F)" />
                    <ToolbarButton icon={<AlignLeft size={14} />} onClick={handleFormat} title="Format Document (Shift+Alt+F)" />
                    <div className="w-px h-4 bg-white/10 mx-2" />
                    <ToolbarButton
                        icon={<WrapText size={14} />}
                        onClick={toggleWordWrap}
                        active={wordWrap === 'on'}
                        title="Toggle Word Wrap"
                    />
                    <div className="flex items-center space-x-1 ml-2">
                        <ToolbarButton icon={<ZoomOut size={14} />} onClick={zoomOut} title="Zoom Out" />
                        <span className="text-[10px] text-zinc-400 min-w-[3ch] text-center">{fontSize}</span>
                        <ToolbarButton icon={<ZoomIn size={14} />} onClick={zoomIn} title="Zoom In" />
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 relative">
                    <Editor
                        height="100%"
                        defaultLanguage={language}
                        defaultValue={initialContent}
                        theme="transparent-dark"
                        onMount={handleEditorDidMount}
                        onChange={handleContentChange}
                        options={{
                            minimap: { enabled: true },
                            fontSize: fontSize,
                            wordWrap: wordWrap,
                            automaticLayout: true,
                            padding: { top: 16, bottom: 16 },
                            scrollBeyondLastLine: false,
                            renderWhitespace: 'selection',
                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                            smoothScrolling: true,
                            cursorBlinking: "smooth",
                            cursorSmoothCaretAnimation: "on"
                        }}
                    />
                </div>

                {/* Footer status bar */}
                <div className="h-6 bg-blue-600/50 backdrop-blur-md text-white text-[10px] px-4 flex items-center justify-between select-none border-t border-white/10">
                    <div className="flex items-center space-x-4">
                        <span>{language.toUpperCase()}</span>
                        <span>Shift+Alt+F for Format</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span>Ln {1}, Col {1}</span> {/* Placeholder, requires cursor tracking logic */}
                        <span>UTF-8</span>
                    </div>
                </div>

                {/* Confirmation Modal */}
                <ConfirmModal
                    isOpen={showCloseConfirm}
                    onClose={() => setShowCloseConfirm(false)}
                    onConfirm={confirmClose}
                    title="Unsaved Changes"
                    message="You have unsaved changes. Are you sure you want to close without saving?"
                    confirmLabel="Discard Changes"
                    isDestructive={true}
                />
            </div>
        </div>
    );
}

function ToolbarButton({ icon, onClick, title, active = false }: { icon: React.ReactNode, onClick: () => void, title: string, active?: boolean }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded-md transition-colors ${active ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
        >
            {icon}
        </button>
    );
}
