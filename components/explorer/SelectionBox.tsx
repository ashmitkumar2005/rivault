"use client";

import { createPortal } from 'react-dom';

interface SelectionBoxProps {
    start: { x: number, y: number } | null;
    current: { x: number, y: number } | null;
}

export default function SelectionBox({ start, current }: SelectionBoxProps) {
    if (!start || !current) return null;

    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    return createPortal(
        <div
            className="fixed z-50 pointer-events-none border border-blue-500/50 bg-blue-500/10 rounded-sm backdrop-blur-[1px]"
            style={{
                left,
                top,
                width,
                height,
                transform: 'translateZ(0)', // Optimize compositing
            }}
        />,
        document.body
    );
}
