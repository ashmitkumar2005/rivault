import React, { useState } from 'react';
import { X, HardDrive } from 'lucide-react';
import { createDrive } from '@/lib/api';

interface AddDriveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddDriveModal({ isOpen, onClose, onSuccess }: AddDriveModalProps) {
    const [letter, setLetter] = useState('D');
    const [sizeGB, setSizeGB] = useState(10);
    const [isHidden, setIsHidden] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (isHidden && !accessCode) {
                throw new Error("Access code is required for hidden drives");
            }
            await createDrive(letter.toUpperCase(), sizeGB * 1024 * 1024 * 1024, isHidden, accessCode);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to create drive");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden p-6 ring-1 ring-white/5">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-white flex items-center">
                        <HardDrive className="mr-2 text-blue-400" size={20} />
                        New Drive
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase">Drive Letter</label>
                        <select
                            value={letter}
                            onChange={(e) => setLetter(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                        >
                            {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
                                <option key={char} value={char} disabled={char === 'C'}>
                                    {char}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase">Size (GB)</label>
                        <input
                            type="number"
                            min="1"
                            max="1000"
                            value={sizeGB}
                            onChange={(e) => setSizeGB(parseInt(e.target.value) || 0)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={isHidden}
                                onChange={e => setIsHidden(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-black/20 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 focus:bg-blue-600/20"
                            />
                            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors select-none">Hidden Drive</span>
                        </label>
                    </div>

                    {isHidden && (
                        <div className="animate-fade-in-down">
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase">Secret Access Code</label>
                            <input
                                type="text"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                placeholder="e.g. 0329"
                                className="w-full bg-black/20 border border-blue-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-zinc-600"
                                required
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">Type this code blindly anywhere to open the drive.</p>
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all text-sm font-medium flex items-center justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Drive'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
