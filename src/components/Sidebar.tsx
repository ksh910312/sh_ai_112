import React, { useRef, useState } from 'react';
import {
  FolderUp,
  FilePlus,
  Folder,
  FileText,
  Trash2,
  Eye,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  UploadCloud,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { RegulationDocument } from '../types/rag';
import { SAMPLE_FOLDERS, SampleFolder } from '../data/sampleRegulations';
import {
  processUploadedFiles,
  traverseDataTransferItems,
} from '../utils/fileParser';

interface SidebarProps {
  documents: RegulationDocument[];
  onAddDocuments: (docs: RegulationDocument[]) => void;
  onRemoveDocument: (docId: string) => void;
  onClearDocuments: () => void;
  onSelectDocument: (doc: RegulationDocument) => void;
  onLoadPreset: (preset: SampleFolder) => void;
  isOpen: boolean;
  onClose: () => void;
  isProcessing: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  onAddDocuments,
  onRemoveDocument,
  onClearDocuments,
  onSelectDocument,
  onLoadPreset,
  isOpen,
  onClose,
  isProcessing,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group documents by folderPath
  const groupedDocs: Record<string, RegulationDocument[]> = {};
  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.fileName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.folderPath.toLowerCase().includes(searchFilter.toLowerCase())
  );

  for (const doc of filtered) {
    const folder = doc.folderPath || '루트 폴더';
    if (!groupedDocs[folder]) {
      groupedDocs[folder] = [];
    }
    groupedDocs[folder].push(doc);
  }

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  // Handle folder upload via input
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const docs = await processUploadedFiles(files);
    if (docs.length > 0) {
      onAddDocuments(docs);
    }
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // Handle files upload via input
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const docs = await processUploadedFiles(files);
    if (docs.length > 0) {
      onAddDocuments(docs);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    let files: File[] = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      files = await traverseDataTransferItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      files = Array.from(e.dataTransfer.files);
    }

    if (files.length > 0) {
      const docs = await processUploadedFiles(files);
      if (docs.length > 0) {
        onAddDocuments(docs);
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-slate-200 bg-slate-50/95 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800">규정 폴더 및 문서</h2>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {documents.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Buttons: Folder Upload & File Upload */}
        <div className="border-b border-slate-200 bg-white p-3 space-y-2">
          {/* Hidden Inputs */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore webkitdirectory is standard in Chromium/Safari/Firefox
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderUpload}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.json,.csv,.xml,.html"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              <FolderUp className="h-3.5 w-3.5" />
              <span>폴더 업로드</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
            >
              <FilePlus className="h-3.5 w-3.5 text-slate-500" />
              <span>파일 추가</span>
            </button>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700'
                : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300'
            }`}
          >
            <UploadCloud className="h-5 w-5 mb-1 text-slate-400" />
            <p className="text-xs font-medium">폴더나 규정 파일을 여기에 드래그</p>
            <p className="text-[10px] text-slate-400 mt-0.5">.md, .txt, .json, .csv 등 지원</p>
          </div>
        </div>

        {/* Sample Regulation Presets */}
        <div className="border-b border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>샘플 규정 프리셋</span>
            </span>
            <span className="text-[10px] text-slate-400">1클릭 테스트</span>
          </div>
          <div className="space-y-1.5">
            {SAMPLE_FOLDERS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onLoadPreset(preset)}
                className="flex w-full items-start gap-2 rounded-lg border border-slate-200/90 bg-white p-2 text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-xs"
              >
                <div className="mt-0.5 text-base">{preset.id.startsWith('univ') ? '🎓' : '🏢'}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="font-semibold text-slate-800 truncate">{preset.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{preset.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search input for loaded documents */}
        {documents.length > 0 && (
          <div className="p-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="규정 문서 검색..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Document List by Folder */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {documents.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center p-4">
              <FileSpreadsheet className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">등록된 규정 파일이 없습니다</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                상단의 <strong>폴더 업로드</strong> 버튼을 누르거나 위 <strong>샘플 프리셋</strong>을 클릭해보세요.
              </p>
            </div>
          ) : Object.keys(groupedDocs).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              검색 조건에 맞는 규정 문서가 없습니다.
            </div>
          ) : (
            Object.entries(groupedDocs).map(([folderName, docs]) => {
              const isCollapsed = collapsedFolders[folderName];
              return (
                <div key={folderName} className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  {/* Folder Header */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(folderName)}
                    className="flex w-full items-center justify-between bg-slate-100/70 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/60"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      )}
                      <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{folderName}</span>
                    </div>
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-600">
                      {docs.length}
                    </span>
                  </button>

                  {/* Documents in Folder */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="group flex items-center justify-between px-2.5 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <div
                            onClick={() => onSelectDocument(doc)}
                            className="flex-1 cursor-pointer overflow-hidden mr-2"
                            title="클릭하여 원문 및 조항 확인"
                          >
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {doc.title}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span>조항/청크: {doc.chunks.length}개</span>
                              <span>·</span>
                              <span>{(doc.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => onSelectDocument(doc)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              title="원문 보기"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveDocument(doc.id)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="문서 삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: Clear All button */}
        {documents.length > 0 && (
          <div className="border-t border-slate-200 bg-white p-3">
            <button
              type="button"
              onClick={onClearDocuments}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>전체 규정 문서 비우기</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
