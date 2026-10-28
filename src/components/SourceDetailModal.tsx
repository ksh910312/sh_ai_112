import React, { useState } from 'react';
import { X, BookOpen, Copy, Check, ExternalLink } from 'lucide-react';
import { RetrievedChunk, RegulationDocument } from '../types/rag';

interface SourceDetailModalProps {
  retrievedChunk: RetrievedChunk | null;
  onClose: () => void;
  onOpenFullDocument?: (doc: RegulationDocument) => void;
  documents?: RegulationDocument[];
}

export const SourceDetailModal: React.FC<SourceDetailModalProps> = ({
  retrievedChunk,
  onClose,
  onOpenFullDocument,
  documents = [],
}) => {
  const [copied, setCopied] = useState(false);

  if (!retrievedChunk) return null;

  const { chunk, score, keywordScore, vectorScore, matchedKeywords } = retrievedChunk;
  const matchPct = Math.round(score * 100);

  const matchedDoc = documents.find((d) => d.id === chunk.docId);

  const handleCopy = () => {
    navigator.clipboard.writeText(chunk.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3 overflow-hidden mr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                  근거 조항 인용
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  유사도 {matchPct}%
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 truncate mt-1">
                {chunk.sectionTitle || chunk.docTitle}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Retrieval Metadata Bar */}
        <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-2.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>
              문서: <strong className="text-slate-800">{chunk.fileName}</strong>
            </span>
            <span>·</span>
            <span>
              폴더: <strong className="text-slate-800">{chunk.folderPath}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>키워드 일치: {Math.round(keywordScore * 100)}%</span>
            {vectorScore > 0 && <span>· 벡터: {Math.round(vectorScore * 100)}%</span>}
          </div>
        </div>

        {/* Matched Keywords Tags */}
        {matchedKeywords.length > 0 && (
          <div className="bg-indigo-50/40 px-6 py-2 border-b border-indigo-100 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-indigo-900">검색 매칭 키워드:</span>
            {matchedKeywords.slice(0, 8).map((kw, i) => (
              <span
                key={i}
                className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200 shadow-2xs"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            발췌된 원문 조항 내용
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
            {chunk.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
          {matchedDoc && onOpenFullDocument ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullDocument(matchedDoc);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>규정 문서 전체 원문 보기</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>조항 복사</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
