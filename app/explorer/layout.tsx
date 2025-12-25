"use client";

import React from "react";
import { FileSystemProvider } from "@/components/providers/FileSystemProvider";

export default function ExplorerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <FileSystemProvider>
            <div className="flex h-screen overflow-hidden bg-zinc-950">
                {children}
            </div>
        </FileSystemProvider>
    );
}
