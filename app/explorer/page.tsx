"use client";

import React from "react";
import Sidebar from "@/components/explorer/Sidebar";
import MainView from "@/components/explorer/MainView";

export default function ExplorerPage() {
    return (
        <div className="flex w-full h-full">
            <Sidebar />
            <MainView />
        </div>
    );
}
