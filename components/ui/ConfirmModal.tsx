import React from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    isDestructive?: boolean;
}

export default function ConfirmModal({
    isOpen, onClose, onConfirm, title, message,
    confirmLabel = "Confirm", isDestructive = false
}: ConfirmModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${isDestructive
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-900/20"
                                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <div className="text-sm text-zinc-400">
                {message}
            </div>
        </Modal>
    );
}
