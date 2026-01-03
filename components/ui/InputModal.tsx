import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    message?: string;
    initialValue?: string;
    placeholder?: string;
    submitLabel?: string;
    type?: string;
}

export default function InputModal({
    isOpen, onClose, onSubmit, title, message, initialValue = "", placeholder, submitLabel = "Submit", type = "text"
}: InputModalProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        // if (!value.trim()) return; // Allow empty if type is password? No, empty password usually invalid. 
        if (!value.trim()) return;
        onSubmit(value);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleSubmit()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-900/20 transition-all"
                    >
                        {submitLabel}
                    </button>
                </>
            }
        >
            <form onSubmit={handleSubmit}>
                {message && <p className="text-sm text-zinc-400 mb-4">{message}</p>}
                <input
                    type={type}
                    autoFocus
                    className="w-full bg-black/40 border border-white/10 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none placeholder-zinc-600 transition-all"
                    placeholder={placeholder}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                />
            </form>
        </Modal>
    );
}
