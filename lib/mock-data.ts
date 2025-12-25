import { FileSystemItem } from "@/types/file-system";

const now = new Date();

export const INITIAL_ITEMS: FileSystemItem[] = [
    // ROOT
    {
        id: "root",
        parentId: null,
        name: "Rivault",
        type: "folder",
        updatedAt: now,
    },

    // Documents
    {
        id: "docs",
        parentId: "root",
        name: "Documents",
        type: "folder",
        updatedAt: now,
    },
    {
        id: "resume",
        parentId: "docs",
        name: "Resume.pdf",
        type: "document",
        size: 2400000,
        updatedAt: now,
    },
    {
        id: "budget",
        parentId: "docs",
        name: "Budget_2024.xlsx",
        type: "document",
        size: 15600,
        updatedAt: now,
    },

    // Images
    {
        id: "photos",
        parentId: "root",
        name: "Photos",
        type: "folder",
        updatedAt: now,
    },
    {
        id: "vacation",
        parentId: "photos",
        name: "Vacation",
        type: "folder",
        updatedAt: now,
    },
    {
        id: "img1",
        parentId: "vacation",
        name: "beach.jpg",
        type: "image",
        size: 4500000,
        updatedAt: now,
    },
    {
        id: "img2",
        parentId: "photos",
        name: "profile.png",
        type: "image",
        size: 1200000,
        updatedAt: now,
    },

    // Work
    {
        id: "work",
        parentId: "root",
        name: "Work",
        type: "folder",
        updatedAt: now,
    },
    {
        id: "project-x",
        parentId: "work",
        name: "Project X",
        type: "folder",
        updatedAt: now,
    },
    {
        id: "specs",
        parentId: "project-x",
        name: "specs.docx",
        type: "document",
        size: 89000,
        updatedAt: now,
    },
];
