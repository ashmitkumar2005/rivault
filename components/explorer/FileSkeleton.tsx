"use client";

import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

interface FileSkeletonProps {
    viewMode: 'list' | 'grid';
    count?: number;
}

export default function FileSkeleton({ viewMode, count = 8 }: FileSkeletonProps) {
    if (viewMode === 'grid') {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 animate-fade-in">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="glass-panel p-4 rounded-3xl border border-white/5 flex flex-col items-center space-y-4">
                        <Skeleton className="w-16 h-16 rounded-2xl" />
                        <div className="w-full space-y-2">
                            <Skeleton className="h-4 w-3/4 mx-auto rounded-lg" />
                            <Skeleton className="h-3 w-1/2 mx-auto rounded-lg opacity-50" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2 animate-fade-in">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 px-4 py-3 rounded-xl border border-transparent">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3 rounded-lg" />
                        <div className="flex space-x-4">
                            <Skeleton className="h-3 w-16 rounded-lg opacity-50" />
                            <Skeleton className="h-3 w-24 rounded-lg opacity-50" />
                        </div>
                    </div>
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0 opacity-20" />
                </div>
            ))}
        </div>
    );
}
