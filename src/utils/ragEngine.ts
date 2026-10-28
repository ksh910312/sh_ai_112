import { RegulationChunk, RetrievedChunk } from '../types/rag';

/**
 * Tokenize Korean and alphanumeric text into searchable terms and character n-grams
 */
export function tokenizeKorean(text: string): string[] {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/[^\w\sㄱ-ㅎ가-힣]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  const tokens = new Set<string>();

  for (const w of words) {
    tokens.add(w);
    // Korean character bigrams for compound words (e.g. '학사경고' -> '학사', '사경', '경고')
    if (w.length >= 2 && /[ㄱ-힣]/.test(w)) {
      for (let i = 0; i < w.length - 1; i++) {
        tokens.add(w.slice(i, i + 2));
      }
      if (w.length >= 3) {
        for (let i = 0; i < w.length - 2; i++) {
          tokens.add(w.slice(i, i + 3));
        }
      }
    }
  }

  // Also extract article numbers like "제15조", "15조"
  const articleMatches = text.match(/제?\s*\d+\s*조/g);
  if (articleMatches) {
    articleMatches.forEach((m) => {
      tokens.add(m.replace(/\s+/g, ''));
    });
  }

  return Array.from(tokens);
}

/**
 * Calculate Cosine Similarity between two numeric vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * BM25 Retrieval Engine for Korean Regulation Chunks
 */
export class BM25Index {
  private chunks: RegulationChunk[] = [];
  private docTokens: string[][] = [];
  private docLengths: number[] = [];
  private avgDocLength: number = 0;
  private df: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private k1: number = 1.5;
  private b: number = 0.75;

  constructor(chunks: RegulationChunk[]) {
    this.buildIndex(chunks);
  }

  public buildIndex(chunks: RegulationChunk[]) {
    this.chunks = chunks;
    this.docTokens = [];
    this.docLengths = [];
    this.df.clear();
    this.idf.clear();

    let totalLength = 0;
    for (const chunk of chunks) {
      // Include title, section, and content for rich lexical matching
      const fullSearchable = `${chunk.docTitle} ${chunk.sectionTitle} ${chunk.content}`;
      const tokens = tokenizeKorean(fullSearchable);
      this.docTokens.push(tokens);
      this.docLengths.push(tokens.length);
      totalLength += tokens.length;

      const uniqueTokens = new Set(tokens);
      for (const t of uniqueTokens) {
        this.df.set(t, (this.df.get(t) || 0) + 1);
      }
    }

    const n = chunks.length;
    this.avgDocLength = n > 0 ? totalLength / n : 1;

    // Precompute IDF with Robertson-Spärck Jones formula
    for (const [term, freq] of this.df.entries()) {
      const idfVal = Math.log(1 + (n - freq + 0.5) / (freq + 0.5));
      this.idf.set(term, Math.max(idfVal, 0.1));
    }
  }

  public search(query: string): { chunkIndex: number; score: number; matchedKeywords: string[] }[] {
    const queryTokens = tokenizeKorean(query);
    if (queryTokens.length === 0 || this.chunks.length === 0) return [];

    const scores: { chunkIndex: number; score: number; matchedKeywords: string[] }[] = [];

    for (let i = 0; i < this.chunks.length; i++) {
      const docTokens = this.docTokens[i];
      const docLen = this.docLengths[i];
      let docScore = 0;
      const matched: string[] = [];

      // Calculate term frequency in current chunk
      const tfMap = new Map<string, number>();
      for (const t of docTokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      for (const qTerm of queryTokens) {
        const tf = tfMap.get(qTerm) || 0;
        if (tf > 0) {
          matched.push(qTerm);
          const idfVal = this.idf.get(qTerm) || 0.1;
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
          docScore += idfVal * (numerator / denominator);
        }
      }

      // Exact article number bonus (e.g. if query contains '제15조' and chunk is for '제15조')
      const articleNum = this.chunks[i].articleNumber;
      if (articleNum && query.includes(articleNum)) {
        docScore *= 1.8;
      }

      scores.push({
        chunkIndex: i,
        score: docScore,
        matchedKeywords: Array.from(new Set(matched)),
      });
    }

    return scores;
  }
}

/**
 * Hybrid RAG Search (Vector Cosine Similarity + BM25 Lexical + Article Boost)
 */
export async function searchRegulations(
  query: string,
  chunks: RegulationChunk[],
  bm25: BM25Index,
  options: {
    topK?: number;
    similarityThreshold?: number;
    vectorWeight?: number;
    queryEmbedding?: number[];
  } = {}
): Promise<RetrievedChunk[]> {
  const {
    topK = 4,
    similarityThreshold = 0.1,
    vectorWeight = 0.5,
    queryEmbedding,
  } = options;

  if (chunks.length === 0 || !query.trim()) {
    return [];
  }

  // 1. BM25 Search
  const bm25Results = bm25.search(query);
  const bm25Map = new Map<number, { score: number; matched: string[] }>();
  let maxBm25 = 0.0001;

  for (const res of bm25Results) {
    bm25Map.set(res.chunkIndex, { score: res.score, matched: res.matchedKeywords });
    if (res.score > maxBm25) maxBm25 = res.score;
  }

  // 2. Hybrid Scoring
  const scoredChunks: RetrievedChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const bm25Info = bm25Map.get(i) || { score: 0, matched: [] };
    const normBm25 = bm25Info.score / maxBm25; // 0 to 1

    let vectorScore = 0;
    if (queryEmbedding && chunk.embedding && chunk.embedding.length > 0) {
      vectorScore = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
    }

    // Hybrid combination
    let finalScore = 0;
    if (queryEmbedding && chunk.embedding && chunk.embedding.length > 0) {
      finalScore = normBm25 * (1 - vectorWeight) + vectorScore * vectorWeight;
    } else {
      finalScore = normBm25;
    }

    // Additional boost if query tokens match in sectionTitle (e.g. "휴학", "출장")
    const lowerQuery = query.toLowerCase();
    if (chunk.sectionTitle && lowerQuery.includes(chunk.sectionTitle.toLowerCase())) {
      finalScore = Math.min(1.0, finalScore * 1.3);
    }

    if (finalScore >= similarityThreshold) {
      scoredChunks.push({
        chunk,
        score: finalScore,
        keywordScore: normBm25,
        vectorScore,
        matchedKeywords: bm25Info.matched,
      });
    }
  }

  // Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score);

  return scoredChunks.slice(0, topK);
}

/**
 * Batch generate embeddings via server endpoint /api/gemini/embed
 */
export async function fetchEmbeddingsFromServer(texts: string[]): Promise<number[][] | null> {
  try {
    const res = await fetch('/api/gemini/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data.embeddings)) {
      return data.embeddings;
    }
    return null;
  } catch (err) {
    console.warn('Embedding request failed, using BM25 fallback:', err);
    return null;
  }
}
