
import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Save, FileText } from 'lucide-react';
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
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Update dirty state if content changes? 
    // Ideally we track if current content != initialContent, 
    // but for now simple dirty flag on change is enough usage for "unsaved changes" warning if we implement it.

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]); // Editor ref is stable, but we need to ensure this listener is active when modal is open

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

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
        } catch (error) {
            console.error("Failed to save:", error);
            // Optionally trigger an alert here or let parent handle it
        } finally {
            setIsSaving(false);
        }
    };

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
            <div className="w-full h-full md:w-[90vw] md:h-[90vh] bg-[#1e1e1e]/60 backdrop-blur-xl md:rounded-xl shadow-2xl flex flex-col border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="h-12 bg-[#2d2d2d]/40 backdrop-blur-sm flex items-center justify-between px-4 border-b border-black/50 select-none">
                    <div className="flex items-center space-x-3">
                        <FileText size={18} className="text-blue-400" />
                        <span className="text-sm font-medium text-zinc-200">{fileName}</span>
                        {isDirty && <span className="text-xs text-zinc-500 italic ml-2">● Edited</span>}
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSaving ? 'text-zinc-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            <Save size={14} className={isSaving ? "animate-spin" : ""} />
                            <span>{isSaving ? "Saving..." : "Save"}</span>
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-2" />
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 relative">
                    <Editor
                        height="100%"
                        defaultLanguage={language}
                        defaultValue={initialContent}
                        theme="vs-dark"
                        onMount={handleEditorDidMount}
                        onChange={() => !isDirty && setIsDirty(true)}
                        options={{
                            minimap: { enabled: true },
                            fontSize: 14,
                            wordWrap: 'on',
                            automaticLayout: true,
                            padding: { top: 16, bottom: 16 },
                            scrollBeyondLastLine: false,
                            renderWhitespace: 'selection',
                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                        }}
                    />
                </div>

                {/* Footer status bar */}
                <div className="h-6 bg-[#007acc] text-white text-[10px] px-4 flex items-center justify-between select-none">
                    <div className="flex items-center space-x-4">
                        <span>{language.toUpperCase()}</span>
                        <span>Shift+Alt+F for Format (if available)</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span>Ctrl+S to Save</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
