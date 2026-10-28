import { RegulationDocument } from '../types/rag';
import { chunkRegulationText, ChunkOptions } from './chunker';

const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.xml',
  '.html',
  '.htm',
  '.doc',
  '.docx',
  '.pdf',
];

export function isFileSupported(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Clean regulation document title from file name
 */
export function formatDocTitle(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/^[\d_.\-\s]+/, '') // remove leading numbers/order prefix (e.g., "01_")
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Extract clean folder path from webkitRelativePath
 */
export function extractFolderPath(relativePath: string): string {
  if (!relativePath || !relativePath.includes('/')) return '루트 폴더';
  const parts = relativePath.split('/');
  parts.pop(); // remove fileName
  return parts.join('/') || '루트 폴더';
}

/**
 * Read browser File object as string
 */
export async function readFileAsText(file: File): Promise<string> {
  // If file is binary or PDF/DOCX where direct text is unavailable, read best effort or text
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve((reader.result as string) || '');
    };
    reader.onerror = () => {
      reject(new Error(`파일 [${file.name}]을 읽는 도중 오류가 발생했습니다.`));
    };
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Process uploaded files (either from <input webkitdirectory> or drag-and-drop)
 */
export async function processUploadedFiles(
  files: File[],
  chunkOptions?: ChunkOptions
): Promise<RegulationDocument[]> {
  const documents: RegulationDocument[] = [];

  for (const file of files) {
    if (!isFileSupported(file.name)) continue;

    try {
      const content = await readFileAsText(file);
      if (!content || !content.trim()) continue;

      const relativePath = file.webkitRelativePath || file.name;
      const folderPath = extractFolderPath(relativePath);
      const title = formatDocTitle(file.name);
      const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const chunks = chunkRegulationText(
        docId,
        title,
        file.name,
        folderPath,
        content,
        chunkOptions
      );

      documents.push({
        id: docId,
        fileName: file.name,
        filePath: relativePath,
        folderPath,
        title,
        content,
        size: file.size,
        lastModified: file.lastModified,
        chunks,
      });
    } catch (err) {
      console.error(`Failed to process file ${file.name}:`, err);
    }
  }

  return documents;
}

/**
 * Recursively read directory entries from Drag & Drop
 */
export async function traverseDataTransferItems(
  items: DataTransferItemList
): Promise<File[]> {
  const files: File[] = [];

  async function traverseEntry(entry: any, currentPath: string = ''): Promise<void> {
    if (!entry) return;

    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file((file: File) => {
          // Attach simulated webkitRelativePath
          const path = currentPath ? `${currentPath}/${file.name}` : file.name;
          Object.defineProperty(file, 'webkitRelativePath', {
            value: path,
            writable: false,
          });
          files.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        dirReader.readEntries((results: any[]) => resolve(results));
      });

      const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      for (const child of entries) {
        await traverseEntry(child, nextPath);
      }
    }
  }

  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      promises.push(traverseEntry(entry));
    } else {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  await Promise.all(promises);
  return files;
}
