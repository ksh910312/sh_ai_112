import { RegulationChunk } from '../types/rag';

export interface ChunkOptions {
  chunkSize?: number; // default: 700 chars
  chunkOverlap?: number; // default: 120 chars
}

/**
 * Intelligent Regulation Document Chunker
 * Specially designed for Korean legal & corporate regulation documents (Chapters, Articles, Clauses).
 */
export function chunkRegulationText(
  docId: string,
  docTitle: string,
  fileName: string,
  folderPath: string,
  fullText: string,
  options: ChunkOptions = {}
): RegulationChunk[] {
  const { chunkSize = 700, chunkOverlap = 120 } = options;
  const chunks: RegulationChunk[] = [];

  const normalized = fullText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return chunks;

  // Pattern for Korean Regulation Articles: e.g. "제1조 (목적)", "제 15 조(휴학 및 복학)", "제1장 총칙"
  const lines = normalized.split('\n');

  interface RawSection {
    chapter: string;
    article: string;
    sectionTitle: string;
    lines: string[];
  }

  const sections: RawSection[] = [];
  let currentChapter = '';
  let currentArticle = '';
  let currentSectionTitle = docTitle;
  let currentLines: string[] = [];

  const chapterRegex = /^(?:#+\s*)?(제\s*\d+\s*장(?:\s*[:\-.]?\s*[^\n]+)?)/;
  const articleRegex = /^(?:#+\s*)?(제\s*\d+\s*조(?:\s*\([^)]+\))?)/;

  for (const line of lines) {
    const trimmed = line.trim();
    const chapterMatch = trimmed.match(chapterRegex);
    const articleMatch = trimmed.match(articleRegex);

    if (chapterMatch) {
      if (currentLines.length > 0) {
        sections.push({
          chapter: currentChapter,
          article: currentArticle,
          sectionTitle: currentSectionTitle,
          lines: currentLines,
        });
        currentLines = [];
      }
      currentChapter = chapterMatch[1].trim();
      currentSectionTitle = currentChapter;
      currentLines.push(line);
      continue;
    }

    if (articleMatch) {
      if (currentLines.length > 0) {
        sections.push({
          chapter: currentChapter,
          article: currentArticle,
          sectionTitle: currentSectionTitle,
          lines: currentLines,
        });
        currentLines = [];
      }
      currentArticle = articleMatch[1].trim();
      currentSectionTitle = currentChapter
        ? `${currentChapter} > ${currentArticle}`
        : currentArticle;
      currentLines.push(line);
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    sections.push({
      chapter: currentChapter,
      article: currentArticle,
      sectionTitle: currentSectionTitle,
      lines: currentLines,
    });
  }

  // If document didn't match structured articles (plain markdown or raw text), fallback to paragraph chunking
  if (sections.length <= 1 && (!sections[0]?.article || sections[0].lines.length > 30)) {
    return fallbackParagraphChunking(
      docId,
      docTitle,
      fileName,
      folderPath,
      normalized,
      chunkSize,
      chunkOverlap
    );
  }

  // Process sections into chunks
  let chunkIdx = 0;
  for (const sec of sections) {
    const secText = sec.lines.join('\n').trim();
    if (!secText) continue;

    // If section fits within chunkSize, preserve as single cohesive unit
    if (secText.length <= chunkSize) {
      chunks.push({
        id: `${docId}-chunk-${chunkIdx}`,
        docId,
        docTitle,
        fileName,
        folderPath,
        sectionTitle: sec.sectionTitle || docTitle,
        articleNumber: sec.article || undefined,
        content: `[출처: ${docTitle} > ${sec.sectionTitle}]\n${secText}`,
        tokensEstimate: Math.ceil(secText.length / 2),
        chunkIndex: chunkIdx++,
      });
    } else {
      // Split large article by clauses or paragraphs
      const subChunks = splitSubText(secText, chunkSize, chunkOverlap);
      for (const sub of subChunks) {
        chunks.push({
          id: `${docId}-chunk-${chunkIdx}`,
          docId,
          docTitle,
          fileName,
          folderPath,
          sectionTitle: sec.sectionTitle || docTitle,
          articleNumber: sec.article || undefined,
          content: `[출처: ${docTitle} > ${sec.sectionTitle}]\n${sub}`,
          tokensEstimate: Math.ceil(sub.length / 2),
          chunkIndex: chunkIdx++,
        });
      }
    }
  }

  return chunks;
}

function splitSubText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentBuffer = '';

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    if (currentBuffer.length + trimmed.length + 1 <= chunkSize) {
      currentBuffer = currentBuffer ? `${currentBuffer}\n\n${trimmed}` : trimmed;
    } else {
      if (currentBuffer) {
        result.push(currentBuffer);
        // Overlap buffer: take trailing slice
        const overlapSlice = currentBuffer.slice(-chunkOverlap);
        currentBuffer = `${overlapSlice}\n\n${trimmed}`;
      } else {
        // If single paragraph exceeds chunkSize, hard slice
        let start = 0;
        while (start < trimmed.length) {
          const slice = trimmed.slice(start, start + chunkSize);
          result.push(slice);
          start += chunkSize - chunkOverlap;
        }
        currentBuffer = '';
      }
    }
  }

  if (currentBuffer.trim()) {
    result.push(currentBuffer.trim());
  }

  return result.length > 0 ? result : [text];
}

function fallbackParagraphChunking(
  docId: string,
  docTitle: string,
  fileName: string,
  folderPath: string,
  fullText: string,
  chunkSize: number,
  chunkOverlap: number
): RegulationChunk[] {
  const chunks: RegulationChunk[] = [];
  const rawChunks = splitSubText(fullText, chunkSize, chunkOverlap);

  rawChunks.forEach((c, idx) => {
    chunks.push({
      id: `${docId}-chunk-${idx}`,
      docId,
      docTitle,
      fileName,
      folderPath,
      sectionTitle: `${docTitle} (Part ${idx + 1})`,
      content: `[출처: ${docTitle}]\n${c}`,
      tokensEstimate: Math.ceil(c.length / 2),
      chunkIndex: idx,
    });
  });

  return chunks;
}
