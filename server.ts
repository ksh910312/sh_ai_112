import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Function to get or instantiate GoogleGenAI dynamically
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Claude API Key validation endpoint
app.post('/api/claude/validate-key', async (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('sk-ant-')) {
    res.status(400).json({ valid: false, error: '유효한 Anthropic Claude API Key (sk-ant-...) 형식이 아닙니다.' });
    return;
  }

  try {
    // Test with Claude 5.5 family
    let testRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 50,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    // If Haiku 5.5 is not accessible, fallback test with Opus 5.5 or Sonnet 5.5
    if (!testRes.ok) {
      testRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-5-5',
          max_tokens: 50,
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
    }

    if (testRes.ok) {
      res.json({ valid: true, message: 'Claude 5.5 API Key가 성공적으로 검증되었습니다.' });
    } else {
      const errData = await testRes.json().catch(() => ({}));
      const errDetail = errData?.error?.message || `인증 실패 (HTTP ${testRes.status})`;
      res.status(400).json({ valid: false, error: errDetail });
    }
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message || 'Anthropic API 연결 중 네트워크 오류가 발생했습니다.' });
  }
});

// Embeddings endpoint for RAG
app.post('/api/gemini/embed', async (req: Request, res: Response) => {
  const { texts } = req.body;
  if (!Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ error: 'texts must be a non-empty array of strings' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({ error: 'Gemini API is not configured on the server.' });
    return;
  }

  try {
    // Process texts in batches to prevent payload limits
    const embeddings: number[][] = [];
    const batchSize = 16;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      // Generate embeddings
      const batchPromises = batch.map(async (text) => {
        try {
          const result = await ai!.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: text,
          });
          const resAny = result as any;
          const values: number[] = resAny.embedding?.values || resAny.embeddings?.[0]?.values || [];
          return values;
        } catch {
          return [];
        }
      });
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
    }

    res.json({ embeddings });
  } catch (err: any) {
    console.error('Embedding error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate embeddings' });
  }
});

// Chat completion endpoint (Streaming SSE or JSON)
app.post('/api/chat', async (req: Request, res: Response) => {
  const {
    provider = 'gemini',
    geminiModel = 'gemini-3.8-flash',
    claudeModel = 'claude-opus-5-5',
    claudeApiKey,
    messages = [],
    retrievedChunks = [],
    temperature = 0.2,
    stream = true,
  } = req.body;

  if (!messages || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // Construct grounded RAG system instruction
  let contextBlock = '';
  if (retrievedChunks.length > 0) {
    contextBlock = `\n\n[참고 규정 문서 정보]\n아래는 사용자의 질문과 관련된 사내/교내 규정의 실제 조항 발췌본입니다:\n`;
    retrievedChunks.forEach((chunk: any, idx: number) => {
      contextBlock += `\n--- [참고 규정 ${idx + 1}] ---\n`;
      contextBlock += `문서명/파일: ${chunk.fileName || '규정문서'}\n`;
      if (chunk.sectionTitle) contextBlock += `조항/구분: ${chunk.sectionTitle}\n`;
      contextBlock += `내용:\n${chunk.content}\n`;
    });
    contextBlock += `\n--- 참고 규정 종료 ---\n`;
  } else {
    contextBlock = `\n\n[참고 규정]: 등록된 관련 규정이 없거나 검색 결과가 없습니다. 규정에 없는 내용은 추측하지 마세요.`;
  }

  const systemInstruction = `당신은 사용자가 제공한 규정 문서(학칙, 인사규정, 취업규칙, 여비규정, 보안지침 등)를 기반으로 정확하게 안내하는 전문 '규정 RAG 챗봇'입니다.

[답변 원칙]
1. 반드시 위에 제공된 [참고 규정 문서 정보]의 실제 조항 내용에 엄격히 근거하여 정확하고 사실적으로 답변하세요.
2. 답변 작성 시 근거가 되는 규정명과 조항 번호(예: [학칙 제15조 제1항], [여비지급규정 제8조])를 명확히 인용하세요.
3. 제공된 참고 규정에 사용자의 질문에 대한 내용이 없거나 불분명할 경우, 거짓 정보를 지어내지 말고 "제공된 규정 문서에는 해당 사항(예: OOO)에 관한 명시적인 조항이 포함되어 있지 않습니다. 관련 주관 부서에 문의하시기 바랍니다."라고 솔직하고 정중하게 안내하세요.
4. 가독성을 위해 마크다운(제목, 글머리 기호, 번호 매기기, 표, 강조)을 적극 활용하여 요건, 절차, 기한, 예외 사항을 한눈에 파악할 수 있도록 체계적으로 정리하세요.
5. 친절하고 전문적인 비즈니스/공식 톤으로 한국어로 답변하세요.
${contextBlock}`;

  // Handle Claude Provider
  if (provider === 'claude') {
    if (!claudeApiKey || typeof claudeApiKey !== 'string' || !claudeApiKey.trim()) {
      res.status(400).json({
        error: 'Claude API Key가 입력되지 않았습니다. 상단 설정에서 Claude API Key를 입력해주세요.',
      });
      return;
    }

    try {
      // Map user messages
      const claudeMessages = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      // Normalize model to Claude 5.5 family
      let targetModel = 'claude-opus-5-5';
      let effort = 'medium';
      let maxTokens = 12000;

      if (claudeModel === 'claude-sonnet-5-5' || claudeModel.includes('sonnet')) {
        targetModel = 'claude-sonnet-5-5';
        effort = 'high';
        maxTokens = 8192;
      } else if (claudeModel === 'claude-haiku-5-5' || claudeModel.includes('haiku')) {
        targetModel = 'claude-haiku-5-5';
        effort = 'medium';
        maxTokens = 4096;
      } else {
        targetModel = 'claude-opus-5-5';
        effort = 'medium';
        maxTokens = 12000;
      }

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const claudePayload: any = {
          model: targetModel,
          max_tokens: maxTokens,
          system: systemInstruction,
          messages: claudeMessages,
          output_config: { effort },
          stream: true,
        };

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey.trim(),
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(claudePayload),
        });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          let parsedErr = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedErr = parsed.error?.message || errText;
          } catch {
            // Keep errText
          }
          res.write(`data: ${JSON.stringify({ error: `Claude API 오류: ${parsedErr}` })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
          return;
        }

        const reader = claudeRes.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) {
          res.write(`data: ${JSON.stringify({ error: 'Failed to read response stream' })}\n\n`);
          res.end();
          return;
        }

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
                const eventObj = JSON.parse(dataStr);
                // Handle text deltas
                if (eventObj.type === 'content_block_delta' && eventObj.delta?.text) {
                  res.write(`data: ${JSON.stringify({ text: eventObj.delta.text })}\n\n`);
                }
              } catch {
                // Ignore parse errors on ping/keepalive events
              }
            }
          }
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      } else {
        // Non-streaming Claude
        const claudePayload: any = {
          model: targetModel,
          max_tokens: maxTokens,
          system: systemInstruction,
          messages: claudeMessages,
          output_config: { effort },
        };

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey.trim(),
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(claudePayload),
        });

        if (!claudeRes.ok) {
          const errData = await claudeRes.json().catch(() => ({}));
          res.status(claudeRes.status).json({
            error: errData?.error?.message || `Claude API 오류 (${claudeRes.status})`,
          });
          return;
        }

        const data = await claudeRes.json();
        const text = data.content?.find((b: any) => b.type === 'text')?.text || data.content?.[0]?.text || '';
        res.json({ text });
        return;
      }
    } catch (err: any) {
      console.error('Claude error:', err);
      if (stream && !res.headersSent) {
        res.status(500).json({ error: err.message || 'Claude API 요청 실패' });
      } else if (stream) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: err.message || 'Claude API 요청 실패' });
      }
      return;
    }
  }

  // Default: Gemini Provider
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'Gemini API Key가 서버 환경 변수(GEMINI_API_KEY)에 설정되어 있지 않습니다. 상단 모델 선택에서 Claude를 선택하고 Claude API Key를 입력하여 사용하시거나, Settings > Secrets에서 Gemini API 키를 연결해주세요.',
    });
    return;
  }

  try {
    // Format Gemini contents
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseStream = await ai.models.generateContentStream({
        model: geminiModel || 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: Math.min(Math.max(temperature, 0), 1),
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } else {
      const response = await ai.models.generateContent({
        model: geminiModel || 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: Math.min(Math.max(temperature, 0), 1),
        },
      });

      res.json({ text: response.text || '' });
    }
  } catch (err: any) {
    console.error('Gemini error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Gemini API 생성 실패' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
