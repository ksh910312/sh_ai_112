import React from 'react';

interface MarkdownViewProps {
  content: string;
  onCitationClick?: (citationText: string) => void;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, onCitationClick }) => {
  if (!content) return null;

  // Process text into blocks (paragraphs, tables, lists, headers, quotes, code blocks)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let currentListItems: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = () => {
    if (currentListItems) {
      if (currentListItems.type === 'ul') {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2.5 ml-5 list-disc space-y-1.5 text-slate-800">
            {currentListItems.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInlineFormatted(item, onCitationClick)}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-2.5 ml-5 list-decimal space-y-1.5 text-slate-800">
            {currentListItems.items.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {renderInlineFormatted(item, onCitationClick)}
              </li>
            ))}
          </ol>
        );
      }
      currentListItems = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      const headerRow = tableBuffer[0];
      const bodyRows = tableBuffer.slice(2); // Skip separator row

      const parseRow = (rowStr: string) =>
        rowStr
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

      const headers = parseRow(headerRow);

      elements.push(
        <div key={`table-${elements.length}`} className="my-3.5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left">
                    {renderInlineFormatted(h, onCitationClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {bodyRows.map((r, rIdx) => {
                const cols = parseRow(r);
                return (
                  <tr key={rIdx} className="hover:bg-slate-50/60">
                    {cols.map((col, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-slate-700">
                        {renderInlineFormatted(col, onCitationClick)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${elements.length}`}
            className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3.5 text-xs text-slate-100 font-mono"
          >
            <code>{codeBlockBuffer.join('\n')}</code>
          </pre>
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      tableBuffer.push(trimmed);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable();
    }

    // Unordered lists
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)/);
    if (ulMatch) {
      if (!currentListItems || currentListItems.type !== 'ul') {
        flushList();
        currentListItems = { type: 'ul', items: [] };
      }
      currentListItems.items.push(ulMatch[1]);
      continue;
    }

    // Ordered lists
    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (olMatch) {
      if (!currentListItems || currentListItems.type !== 'ol') {
        flushList();
        currentListItems = { type: 'ol', items: [] };
      }
      currentListItems.items.push(olMatch[2]);
      continue;
    }

    flushList();

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${elements.length}`} className="mt-4 mb-1.5 font-semibold text-slate-900 text-base">
          {renderInlineFormatted(trimmed.slice(4), onCitationClick)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${elements.length}`} className="mt-5 mb-2 font-bold text-slate-900 text-lg border-b border-slate-100 pb-1">
          {renderInlineFormatted(trimmed.slice(3), onCitationClick)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${elements.length}`} className="mt-6 mb-2.5 font-bold text-slate-900 text-xl border-b border-slate-200 pb-1.5">
          {renderInlineFormatted(trimmed.slice(2), onCitationClick)}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-2.5 border-l-4 border-indigo-500 bg-indigo-50/50 px-3.5 py-2 text-sm italic text-slate-700 rounded-r"
        >
          {renderInlineFormatted(trimmed.slice(2), onCitationClick)}
        </blockquote>
      );
      continue;
    }

    // Empty lines
    if (!trimmed) {
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${elements.length}`} className="my-2 leading-relaxed text-slate-800 text-[15px]">
        {renderInlineFormatted(line, onCitationClick)}
      </p>
    );
  }

  flushList();
  flushTable();

  return <div className="space-y-1">{elements}</div>;
};

/**
 * Render inline elements: bold, code, regulation citations like [학칙 제15조]
 */
function renderInlineFormatted(
  text: string,
  onCitationClick?: (citation: string) => void
): React.ReactNode {
  // Regex pattern matching:
  // 1. Citations e.g. [학칙 제15조 제1항] or [취업규칙 제2조]
  // 2. Bold: **text**
  // 3. Inline code: `text`
  const regex = /(\[[^\]]*(?:제\s*\d+\s*조|규정|학칙|취업규칙|지침)[^\]]*\]|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Citations
    if (part.startsWith('[') && part.endsWith(']')) {
      const citationText = part.slice(1, -1);
      return (
        <span
          key={index}
          onClick={() => onCitationClick && onCitationClick(citationText)}
          className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer select-none"
          title="근거 규정 확인하기"
        >
          📜 {citationText}
        </span>
      );
    }

    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 text-slate-800 rounded border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}
