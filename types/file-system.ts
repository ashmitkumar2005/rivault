export type FileType = 'folder' | 'image' | 'video' | 'document' | 'other';

export interface FileSystemItem {
  id: string;
  parentId: string | null;
  name: string;
  type: FileType;
  size?: number; // In bytes
  updatedAt: Date;
}

export type ViewMode = 'list' | 'grid';

export interface FileSystemContextType {
  currentPath: string; // ID of the current folder
  items: FileSystemItem[];
  viewMode: ViewMode;
  pathHistory: string[]; // For back/forward navigation (optional visual)
  
  // Actions
  navigateTo: (folderId: string) => void;
  goUp: () => void;
  toggleViewMode: () => void;
  createFolder: (name: string) => void;
  renameItem: (id: string, newName: string) => void;
  deleteItem: (id: string) => void;
  getCurrentFolderItems: () => FileSystemItem[];
  getItem: (id: string) => FileSystemItem | undefined;
  breadcrumbs: FileSystemItem[];
}
