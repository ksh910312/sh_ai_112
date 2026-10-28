import { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { DocumentModal } from './components/DocumentModal';
import { SourceDetailModal } from './components/SourceDetailModal';
import { ChunkInspectorModal } from './components/ChunkInspectorModal';
import {
  RegulationDocument,
  RegulationChunk,
  ChatMessage,
  RetrievedChunk,
  AppSettings,
} from './types/rag';
import { SAMPLE_FOLDERS, SampleFolder } from './data/sampleRegulations';
import { chunkRegulationText } from './utils/chunker';
import { BM25Index, searchRegulations, fetchEmbeddingsFromServer } from './utils/ragEngine';

const STORAGE_KEYS = {
  DOCS: 'rag_regulation_docs_v1',
  SETTINGS: 'rag_settings_v1',
  MESSAGES: 'rag_chat_messages_v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  geminiModel: 'gemini-3.8-flash',
  claudeModel: 'claude-opus-5-5',
  claudeApiKey: '',
  topK: 4,
  similarityThreshold: 0.15,
  chunkSize: 700,
  chunkOverlap: 120,
  hybridWeightVector: 0.5,
  useEmbeddings: true,
};

export default function App() {
  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const valid55Models = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
        if (parsed.claudeModel && !valid55Models.includes(parsed.claudeModel)) {
          parsed.claudeModel = 'claude-opus-5-5';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Regulation Documents
  const [documents, setDocuments] = useState<RegulationDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DOCS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load documents:', e);
    }

    // Default: initialize with first sample folder preset (한국대학교 학사·학칙 규정집)
    const preset = SAMPLE_FOLDERS[0];
    const initialDocs: RegulationDocument[] = preset.files.map((f, idx) => {
      const docId = `sample-univ-${idx + 1}`;
      const chunks = chunkRegulationText(
        docId,
        f.title,
        f.fileName,
        f.folderPath,
        f.content
      );
      return {
        id: docId,
        fileName: f.fileName,
        filePath: f.filePath,
        folderPath: f.folderPath,
        title: f.title,
        content: f.content,
        size: f.content.length,
        lastModified: Date.now(),
        chunks,
      };
    });
    return initialDocs;
  });

  // Chat Messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load messages:', e);
    }
    return [];
  });

  // Modals & UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<RegulationDocument | null>(null);
  const [viewingSource, setViewingSource] = useState<RetrievedChunk | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
    SAMPLE_FOLDERS[0].suggestedQuestions
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Flatten all chunks from all documents
  const allChunks = useMemo(() => {
    const list: RegulationChunk[] = [];
    documents.forEach((d) => list.push(...d.chunks));
    return list;
  }, [documents]);

  // BM25 Index (rebuilt whenever chunks change)
  const bm25Index = useMemo(() => {
    return new BM25Index(allChunks);
  }, [allChunks]);

  // Persist Documents
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(documents));
    } catch (e) {
      console.warn('Could not persist documents:', e);
    }
  }, [documents]);

  // Persist Settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Could not persist settings:', e);
    }
  }, [settings]);

  // Persist Messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not persist messages:', e);
    }
  }, [messages]);

  // Update Settings
  const handleUpdateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  // Add Uploaded Documents & optionally generate embeddings in background
  const handleAddDocuments = async (newDocs: RegulationDocument[]) => {
    setIsProcessingFiles(true);
    setDocuments((prev) => {
      // Avoid exact duplicates by filePath or fileName
      const filtered = prev.filter(
        (p) => !newDocs.some((n) => n.fileName === p.fileName && n.filePath === p.filePath)
      );
      return [...filtered, ...newDocs];
    });

    // Generate suggested questions from document titles if possible
    const newQuestions = newDocs
      .slice(0, 3)
      .map((d) => `[${d.title}]의 주요 내용과 제1조 목적은 무엇인가요?`);
    if (newQuestions.length > 0) {
      setSuggestedQuestions(newQuestions);
    }

    setIsProcessingFiles(false);
  };

  // Remove single document
  const handleRemoveDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  // Clear all documents
  const handleClearDocuments = () => {
    if (confirm('등록된 모든 규정 문서를 삭제하시겠습니까?')) {
      setDocuments([]);
      setSuggestedQuestions([]);
    }
  };

  // Load a preset folder dataset
  const handleLoadPreset = (preset: SampleFolder) => {
    const presetDocs: RegulationDocument[] = preset.files.map((f, idx) => {
      const docId = `sample-${preset.id}-${idx + 1}`;
      const chunks = chunkRegulationText(
        docId,
        f.title,
        f.fileName,
        f.folderPath,
        f.content
      );
      return {
        id: docId,
        fileName: f.fileName,
        filePath: f.filePath,
        folderPath: f.folderPath,
        title: f.title,
        content: f.content,
        size: f.content.length,
        lastModified: Date.now(),
        chunks,
      };
    });

    setDocuments(presetDocs);
    setSuggestedQuestions(preset.suggestedQuestions);
    setIsSidebarOpen(false);
  };

  // Stop active generation
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      }
      return prev;
    });
  };

  // Send Message with RAG Retrieval Pipeline
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    // Check Claude Key if Claude is active
    if (settings.provider === 'claude' && !settings.claudeApiKey?.trim()) {
      setIsSettingsOpen(true);
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: queryText,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // 1. RAG Retrieval Step: Find top matching regulation chunks
    let retrieved: RetrievedChunk[] = [];
    try {
      // Optional: get query vector embedding if available
      let queryEmbedding: number[] | undefined;
      if (settings.useEmbeddings) {
        const queryEmbedRes = await fetchEmbeddingsFromServer([queryText]);
        if (queryEmbedRes && queryEmbedRes[0]) {
          queryEmbedding = queryEmbedRes[0];
        }
      }

      retrieved = await searchRegulations(queryText, allChunks, bm25Index, {
        topK: settings.topK,
        similarityThreshold: settings.similarityThreshold,
        vectorWeight: settings.hybridWeightVector,
        queryEmbedding,
      });
    } catch (searchErr) {
      console.warn('RAG search error, falling back:', searchErr);
    }

    // 2. Prepare Assistant Message Placeholder
    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      sources: retrieved,
      modelUsed:
        settings.provider === 'gemini'
          ? 'Gemini 3.8 Flash'
          : settings.claudeModel === 'claude-opus-5-5'
            ? 'Claude Opus 5.5'
            : settings.claudeModel === 'claude-sonnet-5-5'
              ? 'Claude Sonnet 5.5'
              : settings.claudeModel === 'claude-haiku-5-5'
                ? 'Claude Haiku 5.5'
                : 'Claude 5.5',
      provider: settings.provider,
      isStreaming: true,
    };

    setMessages([...newMessages, initialAssistantMsg]);

    // 3. Call Server Chat API with SSE streaming
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          provider: settings.provider,
          geminiModel: settings.geminiModel,
          claudeModel: settings.claudeModel,
          claudeApiKey: settings.claudeApiKey,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          retrievedChunks: retrieved.map((r) => ({
            fileName: r.chunk.fileName,
            sectionTitle: r.chunk.sectionTitle,
            content: r.chunk.content,
            score: r.score,
          })),
          temperature: 0.2,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status} 오류가 발생했습니다.`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === assistantMsgId);
                    if (idx !== -1) {
                      const updated = [...prev];
                      updated[idx] = {
                        ...updated[idx],
                        content: accumulatedText,
                      };
                      return updated;
                    }
                    return prev;
                  });
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes('JSON')) {
                  throw parseErr;
                }
              }
            }
          }
        }
      }

      // Mark streaming complete
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === assistantMsgId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            isStreaming: false,
          };
          return updated;
        }
        return prev;
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        console.error('Chat generation error:', err);
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantMsgId);
          const errorMsg = `⚠️ 답변 생성 실패: ${err.message || '알 수 없는 오류가 발생했습니다.'}`;
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              content: updated[idx].content
                ? `${updated[idx].content}\n\n${errorMsg}`
                : errorMsg,
              isStreaming: false,
            };
            return updated;
          }
          return prev;
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = () => {
    // Find last user message
    const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const realIndex = messages.length - 1 - lastUserIndex;
    const lastUserQuery = messages[realIndex].content;

    // Prune messages after that user message
    setMessages(messages.slice(0, realIndex));
    handleSendMessage(lastUserQuery);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased">
      {/* Sidebar with Folder & File Upload */}
      <Sidebar
        documents={documents}
        onAddDocuments={handleAddDocuments}
        onRemoveDocument={handleRemoveDocument}
        onClearDocuments={handleClearDocuments}
        onSelectDocument={(doc) => setViewingDocument(doc)}
        onLoadPreset={handleLoadPreset}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isProcessing={isProcessingFiles}
      />

      {/* Main Chat Layout */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenInspector={() => setIsInspectorOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          totalDocuments={documents.length}
          totalChunks={allChunks.length}
        />

        <ChatArea
          messages={messages}
          onSendMessage={handleSendMessage}
          onRegenerate={handleRegenerate}
          onStopStreaming={handleStopStreaming}
          isLoading={isLoading}
          settings={settings}
          documents={documents}
          onOpenSourceModal={(src) => setViewingSource(src)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          suggestedQuestions={suggestedQuestions}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => setSettings(newSettings)}
        onClearChat={handleClearChat}
      />

      {/* Full Document Viewer Modal */}
      <DocumentModal
        document={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      {/* Grounding Source Citation Detail Modal */}
      <SourceDetailModal
        retrievedChunk={viewingSource}
        onClose={() => setViewingSource(null)}
        documents={documents}
        onOpenFullDocument={(doc) => setViewingDocument(doc)}
      />

      {/* All Indexed Chunks Inspector Modal */}
      <ChunkInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        documents={documents}
      />
    </div>
  );
}
