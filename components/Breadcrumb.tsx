import React from "react";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbProps {
    items: { id: string; name: string }[];
    onNavigate: (index: number) => void;
}

export default function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
    return (
        <nav className="flex items-center text-sm text-zinc-400 select-none overflow-hidden whitespace-nowrap mask-linear-fade">
            <button
                onClick={() => onNavigate(0)} // Index 0 is always root in storing logic
                className={`p-1 rounded-md transition-colors flex items-center ${items.length === 1
                        ? "text-zinc-100 font-medium cursor-default"
                        : "hover:bg-white/10 hover:text-white cursor-pointer"
                    }`}
                disabled={items.length === 1}
            >
                <Home size={16} />
            </button>

            {items.slice(1).map((item, i) => {
                // Real index in the full array is i + 1
                const index = i + 1;
                const isLast = index === items.length - 1;

                return (
                    <React.Fragment key={item.id}>
                        <ChevronRight size={14} className="mx-1 text-zinc-600" />
                        <button
                            onClick={() => !isLast && onNavigate(index)}
                            disabled={isLast}
                            className={`px-2 py-1 rounded-md transition-colors max-w-[150px] truncate ${isLast
                                    ? "text-zinc-100 font-medium cursor-default"
                                    : "hover:bg-white/10 hover:text-white cursor-pointer"
                                }`}
                            title={item.name}
                        >
                            {item.name}
                        </button>
                    </React.Fragment>
                );
            })}
        </nav>
    );
}
