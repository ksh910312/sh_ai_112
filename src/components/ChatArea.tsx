import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RotateCw,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Loader2,
  StopCircle,
} from 'lucide-react';
import { ChatMessage, RetrievedChunk, AppSettings, RegulationDocument } from '../types/rag';
import { MarkdownView } from './MarkdownView';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  onRegenerate: () => void;
  onStopStreaming: () => void;
  isLoading: boolean;
  settings: AppSettings;
  documents: RegulationDocument[];
  onOpenSourceModal: (chunk: RetrievedChunk) => void;
  onOpenSettings: () => void;
  suggestedQuestions: string[];
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  onRegenerate,
  onStopStreaming,
  isLoading,
  settings,
  documents,
  onOpenSourceModal,
  onOpenSettings,
  suggestedQuestions,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isClaude = settings.provider === 'claude';
  const missingClaudeKey = isClaude && !settings.claudeApiKey?.trim();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-1 flex-col bg-white">
      {/* Missing Claude API Key Banner */}
      {missingClaudeKey && (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Claude 모델 사용 안내:</strong> Claude API Key가 등록되지 않았습니다. 답변을 받으려면 API 키를 입력해주세요.
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="rounded-md bg-amber-600 px-3 py-1 font-semibold text-white shadow-2xs hover:bg-amber-700"
          >
            API 키 입력하기
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Welcome View when no messages */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-100">
                <BookOpen className="h-8 w-8" />
              </div>

              <h2 className="mt-4 text-xl font-bold text-slate-900">
                규정 문서 기반 RAG 챗봇
              </h2>
              <p className="mt-1.5 max-w-lg text-sm text-slate-500 leading-relaxed">
                좌측 사이드바에서 업로드한 규정 폴더 파일들을 색인하여 정확한 조항과 원문 근거를 바탕으로 답변합니다.
              </p>

              {/* Status info */}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>
                  현재 색인된 규정 문서: <strong>{documents.length}개</strong> (
                  {documents.reduce((acc, d) => acc + d.chunks.length, 0)}개 조항)
                </span>
                <span>·</span>
                <span className="font-semibold text-indigo-600">
                  {settings.provider === 'gemini'
                    ? 'Gemini 3.8 Flash'
                    : settings.claudeModel === 'claude-opus-5-5'
                      ? 'Claude Opus 5.5'
                      : settings.claudeModel === 'claude-sonnet-5-5'
                        ? 'Claude Sonnet 5.5'
                        : 'Claude Haiku 5.5'}
                </span>
              </div>

              {/* Suggested Questions */}
              {suggestedQuestions.length > 0 && (
                <div className="mt-8 w-full max-w-2xl text-left">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>추천 질문 예시 (클릭 시 자동 질의)</span>
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInputText(q);
                          onSendMessage(q);
                        }}
                        className="group flex items-start justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-900 transition-all shadow-2xs"
                      >
                        <span className="leading-relaxed">{q}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Message List
            messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 md:gap-4 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white shadow-xs">
                      {message.provider === 'claude' ? (
                        <span className="font-bold text-sm">C</span>
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={`flex max-w-[88%] md:max-w-[80%] flex-col ${
                      isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    {/* User Bubble */}
                    {isUser ? (
                      <div className="rounded-2xl rounded-tr-xs bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-xs">
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    ) : (
                      /* Assistant Bubble */
                      <div className="w-full rounded-2xl rounded-tl-xs border border-slate-200 bg-white p-4 md:p-5 shadow-2xs space-y-3">
                        {/* Model & Source Meta Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              {message.modelUsed || (settings.provider === 'gemini' ? 'Gemini 3.8 Flash' : 'Claude')}
                            </span>
                            {message.sources && message.sources.length > 0 && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                                {message.sources.length}개 조항 근거 인용
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Grounding Source Badges */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                                <span>참조 규정 조항 (클릭 시 원문 확인)</span>
                              </span>
                              <span className="text-[10px] text-indigo-600 font-medium">
                                정확도 순위
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {message.sources.map((src, idx) => {
                                const pct = Math.round(src.score * 100);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onOpenSourceModal(src)}
                                    className="group flex items-center gap-1.5 rounded-lg border border-indigo-200/90 bg-white px-2.5 py-1 text-left text-xs hover:border-indigo-400 hover:bg-indigo-50 transition-all shadow-2xs"
                                    title="발췌 조항 전문 및 유사도 확인"
                                  >
                                    <span className="font-semibold text-slate-800 group-hover:text-indigo-800">
                                      {src.chunk.sectionTitle || src.chunk.docTitle}
                                    </span>
                                    <span className="rounded bg-indigo-100 px-1 py-0.2 text-[10px] font-bold text-indigo-700">
                                      {pct}%
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Message Content rendered with MarkdownView */}
                        <div className="text-slate-800">
                          <MarkdownView
                            content={message.content}
                            onCitationClick={(citation) => {
                              // If clicked citation matches a source chunk, open it
                              if (message.sources) {
                                const found = message.sources.find(
                                  (s) =>
                                    s.chunk.sectionTitle.includes(citation) ||
                                    citation.includes(s.chunk.articleNumber || '') ||
                                    s.chunk.content.includes(citation)
                                );
                                if (found) {
                                  onOpenSourceModal(found);
                                  return;
                                }
                              }
                            }}
                          />
                          {message.isStreaming && (
                            <span className="inline-block h-4 w-1.5 animate-pulse bg-indigo-600 ml-1 rounded-sm align-middle" />
                          )}
                        </div>

                        {/* Message Actions */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(message.id, message.content)}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                              title="답변 복사"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold text-[11px]">
                                    복사됨
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span className="text-[11px]">복사</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading Indicator */}
          {isLoading && !messages[messages.length - 1]?.isStreaming && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-2xs">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span>규정 문서에서 관련 조항 검색 및 답변 생성 중...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form Bar */}
      <div className="border-t border-slate-200 bg-white p-4 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-2xl border border-slate-300 bg-white shadow-sm focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/20">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                documents.length === 0
                  ? '규정 문서를 먼저 업로드하거나 샘플 프리셋을 불러와주세요.'
                  : '규정에 대해 질문하세요 (예: 일반휴학 신청 기간과 최대 학기 수는?, 출장 숙박비 기준은?)'
              }
              disabled={isLoading || documents.length === 0}
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-400"
            />

            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50 rounded-b-2xl">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">
                  {settings.provider === 'gemini'
                    ? 'Google Gemini 3.8 Flash'
                    : settings.claudeModel === 'claude-opus-5-5'
                      ? 'Anthropic Claude Opus 5.5'
                      : settings.claudeModel === 'claude-sonnet-5-5'
                        ? 'Anthropic Claude Sonnet 5.5'
                        : 'Anthropic Claude Haiku 5.5'}
                </span>
                <span>·</span>
                <span>상위 {settings.topK}개 조항 검색</span>
                {documents.length > 0 && (
                  <span className="hidden sm:inline">
                    ({documents.length}개 규정 문서 대상)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {isLoading && (
                  <button
                    type="button"
                    onClick={onStopStreaming}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <StopCircle className="h-3.5 w-3.5 text-rose-500" />
                    <span>중단</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || isLoading || documents.length === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-40 transition-all"
                  title="전송 (Enter)"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            Shift + Enter로 줄바꿈 | RAG 시스템은 제공된 규정 조항에 철저히 근거하여 답변하며 추측하지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
