import React, { useState } from 'react';
import { X, Layers, Search, Filter, BookOpen } from 'lucide-react';
import { RegulationChunk, RegulationDocument } from '../types/rag';

interface ChunkInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: RegulationDocument[];
}

export const ChunkInspectorModal: React.FC<ChunkInspectorModalProps> = ({
  isOpen,
  onClose,
  documents,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');

  if (!isOpen) return null;

  const allChunks: RegulationChunk[] = [];
  documents.forEach((d) => {
    allChunks.push(...d.chunks);
  });

  const filtered = allChunks.filter((c) => {
    const matchDoc = selectedDocId === 'all' || c.docId === selectedDocId;
    const matchSearch =
      searchTerm === '' ||
      c.sectionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchDoc && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">RAG 색인 청크(조항) 분석기</h3>
              <p className="text-xs text-slate-500">
                총 {documents.length}개 문서에서 분할·색인된 {allChunks.length}개 조항 청크 전체 탐색
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="조항명, 규정 내용, 키워드 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs focus:border-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-hidden"
              >
                <option value="all">전체 문서 ({documents.length}개)</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.chunks.length}개)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            검색 결과: <strong className="text-indigo-600">{filtered.length}</strong>개 청크
          </div>
        </div>

        {/* Chunks List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              일치하는 조항 청크가 없습니다.
            </div>
          ) : (
            filtered.map((chunk, idx) => (
              <div
                key={chunk.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      {chunk.sectionTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 text-slate-600 font-medium">
                      <BookOpen className="h-3 w-3 text-slate-400" />
                      {chunk.fileName}
                    </span>
                    <span>·</span>
                    <span>약 {chunk.tokensEstimate} 토큰</span>
                  </div>
                </div>

                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {chunk.content}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
