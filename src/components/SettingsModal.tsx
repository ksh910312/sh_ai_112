import React, { useState } from 'react';
import {
  X,
  Key,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { AppSettings } from '../types/rag';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClearChat: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  onClearChat,
}) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestClaudeKey = async () => {
    if (!form.claudeApiKey?.trim()) {
      setKeyValidationStatus({
        valid: false,
        message: 'Claude API Key를 먼저 입력해주세요.',
      });
      return;
    }

    setIsTestingKey(true);
    setKeyValidationStatus(null);

    try {
      const res = await fetch('/api/claude/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: form.claudeApiKey.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setKeyValidationStatus({
          valid: true,
          message: data.message || 'API Key 검증 성공!',
        });
      } else {
        setKeyValidationStatus({
          valid: false,
          message: data.error || 'API Key 인증에 실패했습니다.',
        });
      }
    } catch (err: any) {
      setKeyValidationStatus({
        valid: false,
        message: err.message || '서버와의 통신에 실패했습니다.',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  const handleResetDefaults = () => {
    setForm((prev) => ({
      ...prev,
      topK: 4,
      similarityThreshold: 0.15,
      chunkSize: 700,
      chunkOverlap: 120,
      hybridWeightVector: 0.5,
      useEmbeddings: true,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">RAG 및 모델 환경 설정</h3>
              <p className="text-xs text-slate-500">Gemini & Claude 모델 및 검색 파라미터 구성</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              기본 AI 모델 제공자
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, provider: 'gemini' })}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  form.provider === 'gemini'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Sparkles className="h-5 w-5 text-indigo-600 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Google Gemini</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    서버 환경변수 자동 연동 (Gemini 3.8 Flash)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, provider: 'claude' })}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  form.provider === 'claude'
                    ? 'border-amber-600 bg-amber-50/50 text-amber-950 ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Key className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Anthropic Claude</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    사용자 입력 API Key (Claude 5.5 시리즈)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Claude Model & API Key Configuration */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Key className="h-4 w-4 text-amber-600" />
                <span>Claude API Key 설정</span>
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>로컬 브라우저에만 안전 보관</span>
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Claude 5.5 모델 선택
              </label>
              <select
                value={form.claudeModel}
                onChange={(e) => setForm({ ...form, claudeModel: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-amber-500 focus:outline-hidden"
              >
                <option value="claude-opus-5-5">
                  Claude Opus 5.5 (최신 플래그십 · 1M 토큰 문맥 · Adaptive Thinking 심층 분석)
                </option>
                <option value="claude-sonnet-5-5">
                  Claude Sonnet 5.5 (균형 잡힌 고성능 추론 및 빠른 응답)
                </option>
                <option value="claude-haiku-5-5">
                  Claude Haiku 5.5 (초고속 경량 · 경제적)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Anthropic API Key (sk-ant-...)
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-ant-api03-..."
                  value={form.claudeApiKey || ''}
                  onChange={(e) => {
                    setForm({ ...form, claudeApiKey: e.target.value });
                    setKeyValidationStatus(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-20 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 rounded px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                >
                  {showKey ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestClaudeKey}
                disabled={isTestingKey || !form.claudeApiKey?.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-50 disabled:opacity-50"
              >
                {isTestingKey ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>검증 중...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>API 키 연결 검증하기</span>
                  </>
                )}
              </button>

              {keyValidationStatus && (
                <div
                  className={`flex items-center gap-1 text-xs font-medium ${
                    keyValidationStatus.valid ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {keyValidationStatus.valid ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  <span>{keyValidationStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* RAG Retrieval Parameters */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                RAG 검색 및 청크 파라미터
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600"
              >
                <RotateCcw className="h-3 w-3" />
                <span>기본값 복원</span>
              </button>
            </div>

            {/* Top-K slider */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>참조 조항 수 (Top-K Chunks):</span>
                <span className="font-bold text-indigo-600">{form.topK}개</span>
              </div>
              <input
                type="range"
                min="2"
                max="8"
                step="1"
                value={form.topK}
                onChange={(e) => setForm({ ...form, topK: Number(e.target.value) })}
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                질문마다 규정집에서 가장 관련도가 높은 조항 발췌본을 몇 개 추출할지 결정합니다. (추천: 4~5개)
              </p>
            </div>

            {/* Similarity threshold slider */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>최소 유사도 임계치 (Threshold):</span>
                <span className="font-bold text-indigo-600">
                  {Math.round(form.similarityThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.05"
                value={form.similarityThreshold}
                onChange={(e) =>
                  setForm({ ...form, similarityThreshold: Number(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                이 값보다 유사도가 낮은 무관한 조항은 프롬프트에 주입하지 않습니다.
              </p>
            </div>

            {/* Hybrid weight */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>하이브리드 가중치 (키워드 BM25 vs 벡터 유사도):</span>
                <span className="font-bold text-indigo-600">
                  {Math.round((1 - form.hybridWeightVector) * 100)}% :{' '}
                  {Math.round(form.hybridWeightVector * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={form.hybridWeightVector}
                onChange={(e) =>
                  setForm({ ...form, hybridWeightVector: Number(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                한국어 조항 번호 및 정확한 법률 명칭 일치(BM25)와 의미론적 문맥 유사도(Vector)의 비중을 조절합니다.
              </p>
            </div>

            {/* Clear Chat */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm('현재 대화 내역을 모두 지우시겠습니까?')) {
                    onClearChat();
                    onClose();
                  }
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                대화 기록 비우기 (새 대화 시작)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
};
