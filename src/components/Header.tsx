import React from 'react';
import {
  BookOpen,
  Sparkles,
  Settings as SettingsIcon,
  Key,
  Layers,
  Menu,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AppSettings, LLMProvider } from '../types/rag';

interface HeaderProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenInspector: () => void;
  onToggleSidebar: () => void;
  totalDocuments: number;
  totalChunks: number;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenInspector,
  onToggleSidebar,
  totalDocuments,
  totalChunks,
}) => {
  const isClaude = settings.provider === 'claude';
  const hasClaudeKey = !!settings.claudeApiKey?.trim();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      {/* Left Branding & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
          title="사이드바 열기"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white shadow-sm shadow-indigo-200">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 md:text-lg">규정 RAG 챗봇</h1>
              <span className="hidden rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200/60 sm:inline-block">
                폴더 기반 지능형 검색
              </span>
            </div>
            <p className="text-xs text-slate-500">
              학칙·사규·복무규정 조항 및 원문 근거 인용
            </p>
          </div>
        </div>
      </div>

      {/* Middle Indexing Status Pill */}
      <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 xl:flex">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        <span className="font-medium text-slate-700">색인 상태:</span>
        <span>
          문서 <strong className="text-slate-900">{totalDocuments}</strong>개 ·{' '}
          조항/청크 <strong className="text-slate-900">{totalChunks}</strong>개 준비됨
        </span>
      </div>

      {/* Right Controls: Model Selector, API Key, Settings */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Model Selector */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onUpdateSettings({ provider: 'gemini' })}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
              settings.provider === 'gemini'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Gemini 3.8</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ provider: 'claude' })}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
              settings.provider === 'claude'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="text-amber-600 font-bold">C</span>
            <span>Claude</span>
          </button>
        </div>

        {/* Model Sub-dropdown */}
        {isClaude ? (
          <select
            value={settings.claudeModel}
            onChange={(e) => onUpdateSettings({ claudeModel: e.target.value })}
            className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-amber-500 focus:outline-hidden md:block"
          >
            <option value="claude-opus-5-5">Claude Opus 5.5 (플래그십)</option>
            <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (균형)</option>
            <option value="claude-haiku-5-5">Claude Haiku 5.5 (빠름)</option>
          </select>
        ) : (
          <select
            value={settings.geminiModel}
            onChange={(e) => onUpdateSettings({ geminiModel: e.target.value })}
            className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden md:block"
          >
            <option value="gemini-3.8-flash">Gemini 3.8 Flash (기본)</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
          </select>
        )}

        {/* Claude API Key Status indicator button */}
        {isClaude && (
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              hasClaudeKey
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-amber-300 bg-amber-50 text-amber-800 animate-pulse hover:bg-amber-100'
            }`}
            title="Claude API Key 설정"
          >
            <Key className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {hasClaudeKey ? 'Claude Key 등록됨' : 'Claude Key 필요'}
            </span>
            {hasClaudeKey ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            )}
          </button>
        )}

        {/* Chunks Inspector Button */}
        <button
          type="button"
          onClick={onOpenInspector}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="색인 청크 및 조항 검사기"
        >
          <Layers className="h-4 w-4" />
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="RAG 및 API 설정"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
