export interface RegulationChunk {
  id: string;
  docId: string;
  docTitle: string;
  fileName: string;
  folderPath: string;
  sectionTitle: string; // e.g., "제3장 학사 > 제15조(휴학)"
  articleNumber?: string; // e.g., "제15조"
  content: string;
  tokensEstimate: number;
  embedding?: number[];
  chunkIndex: number;
}

export interface RegulationDocument {
  id: string;
  fileName: string;
  filePath: string;
  folderPath: string;
  title: string;
  content: string;
  size: number;
  lastModified: number;
  chunks: RegulationChunk[];
  category?: string;
}

export interface RetrievedChunk {
  chunk: RegulationChunk;
  score: number; // 0 to 1 (or percentage 0~100)
  keywordScore: number;
  vectorScore: number;
  matchedKeywords: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: RetrievedChunk[];
  modelUsed?: string;
  provider?: 'gemini' | 'claude';
  isStreaming?: boolean;
}

export type LLMProvider = 'gemini' | 'claude';

export interface AppSettings {
  provider: LLMProvider;
  geminiModel: string;
  claudeModel: string;
  claudeApiKey: string;
  topK: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  hybridWeightVector: number; // 0 to 1 (0: keyword only, 1: vector only)
  useEmbeddings: boolean;
}
