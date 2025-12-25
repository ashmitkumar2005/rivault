"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function ErrorPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-100">
            <div className="w-full max-w-lg p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold mb-4">Connection Failed</h1>
                <p className="text-zinc-400 mb-8">
                    Rivault encountered a critical error. This could be due to:
                    <ul className="list-disc text-left max-w-xs mx-auto mt-4 space-y-2">
                        <li>Incorrect Master Password</li>
                        <li>Backend API Unavailable</li>
                        <li>Network Connectivity Issues</li>
                    </ul>
                </p>

                <button
                    onClick={() => router.push("/login")}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded border border-zinc-700 transition-colors"
                >
                    Return into Login
                </button>
            </div>
        </div>
    );
}
