import React, { useState } from 'react';
import { X, FileText, Layers, Search, Copy, Check } from 'lucide-react';
import { RegulationDocument } from '../types/rag';

interface DocumentModalProps {
  document: RegulationDocument | null;
  onClose: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ document, onClose }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'chunks'>('text');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredChunks = document.chunks.filter(
    (c) =>
      c.sectionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3 overflow-hidden mr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <FileText className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {document.title}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                경로: {document.filePath} · 청크: {document.chunks.length}개 · {(document.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-2.5 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'text'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>원문 전체 보기</span>
            </button>
            <button
              onClick={() => setActiveTab('chunks')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'chunks'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>색인 청크 ({document.chunks.length}개)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'chunks' && (
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="조항 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-8 pr-2 text-xs focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">복사됨</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>원문 복사</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'text' ? (
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
              {document.content}
            </pre>
          ) : (
            <div className="space-y-3">
              {filteredChunks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  검색어와 일치하는 조항 청크가 없습니다.
                </div>
              ) : (
                filteredChunks.map((chunk, idx) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                      <span className="font-semibold text-xs text-indigo-700">
                        #{idx + 1} {chunk.sectionTitle}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        약 {chunk.tokensEstimate} 토큰 · 인덱스: {chunk.chunkIndex}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-2.5 rounded-lg font-mono">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
