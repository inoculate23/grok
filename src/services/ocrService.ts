export class CameraCapture {
  private stream: MediaStream | null = null;

  async startCamera(): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      return this.stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      throw error;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  captureImage(videoElement: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0);
      return canvas.toDataURL('image/png');
    }

    throw new Error('Failed to capture image');
  }
}

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc?: '2.0';
  id?: string | number;
  result?: unknown;
  error?: unknown;
};

type McpTool = {
  name?: string;
  description?: string;
  inputSchema?: unknown;
  schema?: unknown;
  [key: string]: unknown;
};

function getViteEnvVar(name: string): string | undefined {
  const meta = import.meta as unknown;
  if (!meta || typeof meta !== 'object') return undefined;
  const env = (meta as { env?: unknown }).env;
  if (!env || typeof env !== 'object') return undefined;
  const val = (env as Record<string, unknown>)[name];
  return typeof val === 'string' ? val : undefined;
}

function shouldUseMcpOcr(): boolean {
  const v = getViteEnvVar('VITE_USE_MCP_OCR');
  return v === 'true';
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return !!val && typeof val === 'object' && !Array.isArray(val);
}

// Utility to convert a data URL to the raw base64 payload
function dataUrlToBase64(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const match = /data:(.*?);base64/.exec(meta);
  const mime = match?.[1] || 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

// Try to upload the image to Supabase Storage to get a public URL
async function toPublicUrl(dataUrl: string): Promise<string> {
  try {
    const { supabase } = await import('../lib/supabase');
    const blob = dataUrlToBlob(dataUrl);
    const fileName = `hf/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const bucket = 'uploads';
    const upload = await supabase.storage.from(bucket).upload(fileName, blob, {
      contentType: blob.type || 'image/png',
      upsert: true,
    });
    if (upload.error) throw upload.error;
    const pub = supabase.storage.from(bucket).getPublicUrl(fileName);
    const url = pub.data?.publicUrl;
    if (typeof url === 'string' && url) return url;
    throw new Error('No public URL returned');
  } catch {
    // Fallback to data URL if upload or env is not configured
    return dataUrl;
  }
}

// Low-level MCP JSON-RPC POST via Vite dev proxy
async function postMcp(payload: JsonRpcRequest): Promise<JsonRpcResponse> {
  const res = await fetch('/hf-mcp', {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP request failed: ${res.status} ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  // Handle Server-Sent Events (SSE) responses by extracting JSON from data: lines
  if (ct.includes('text/event-stream')) {
    const raw = await res.text();
    const blocks = raw.split(/\n\n+/); // events separated by blank line
    let lastObj: unknown = null;
    for (const block of blocks) {
      const dataLines = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim());
      if (!dataLines.length) continue;
      const jsonStr = dataLines.join('\n');
      try {
        const obj = JSON.parse(jsonStr) as JsonRpcResponse;
        // Prefer a block that contains result or error
        if (obj && (('result' in obj) || ('error' in obj))) {
          lastObj = obj;
          break;
        }
        lastObj = obj;
      } catch {
        // ignore parse errors on non-JSON data lines
      }
    }
    if (lastObj && isRecord(lastObj)) {
      return lastObj as JsonRpcResponse;
    }
    throw new Error('MCP SSE response did not contain parseable JSON data.');
  }
  // Standard JSON response
  return (await res.json()) as JsonRpcResponse;
}

// Discover available MCP tools
async function listTools(): Promise<McpTool[]> {
  const resp = await postMcp({
    jsonrpc: '2.0',
    id: 'tools-list',
    method: 'tools/list',
    params: {},
  });
  const r = resp.result;
  if (isRecord(r)) {
    const toolsVal = (r as Record<string, unknown>)['tools'];
    if (Array.isArray(toolsVal)) return toolsVal as McpTool[];
  }
  if (Array.isArray(r)) return r as McpTool[];
  return [];
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const resp = await postMcp({
    jsonrpc: '2.0',
    id: `call-${name}`,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return resp.result ?? resp;
}

function pickImageArgKeyFromSchema(schema: unknown): string | null {
  if (!schema || !isRecord(schema)) return null;
  const obj = schema as { properties?: Record<string, unknown>; input?: { properties?: Record<string, unknown> } };
  const props = obj.properties ?? obj.input?.properties ?? null;
  if (!props) return null;
  const keys = Object.keys(props);
  // Prefer keys that look like base64 image inputs
  const preferred = keys.find((k) => /image.*base64|base64.*image/i.test(k));
  if (preferred) return preferred;
  const imageKey = keys.find((k) => /image|file|data/i.test(k));
  return imageKey || null;
}

export async function extractTextFromImage(imageData: string): Promise<string> {
  const base64 = dataUrlToBase64(imageData);

  // If MCP OCR is disabled, return empty to keep manual input flow
  if (!shouldUseMcpOcr()) {
    return '';
  }

  // Discover a suitable OCR tool from MCP
  const tools = await listTools();
  if (!tools.length) {
    throw new Error('No MCP tools available from the Space.');
  }
  // Heuristics to pick an OCR tool
  const tool =
    tools.find((t) => typeof t.name === 'string' && t.name === 'Multimodal_OCR_generate_image') ||
    tools.find((t) => /ocr|text.*image|vision.*text/i.test(typeof t.name === 'string' ? t.name : '')) ||
    tools.find((t) => /ocr|text.*image|vision.*text/i.test(typeof t.description === 'string' ? t.description : '')) ||
    tools[0];

  // Determine the argument key for image input from schema (if provided)
  const schema = (tool?.inputSchema ?? tool?.schema) as unknown;
  const argKey = pickImageArgKeyFromSchema(schema) ?? 'image';

  const args: Record<string, unknown> = {};
  // Prefer a public URL (Supabase) so the Space can fetch the image directly
  const imageUrl = await toPublicUrl(`data:image/png;base64,${base64}`);
  args[argKey] = imageUrl;
  // Provide defaults from schema when available
  args['model_name'] = 'olmOCR-7B-0725';
  // Revert: do not include instruction prompt to reduce processing
  args['text'] = '';

  const result = await callTool(typeof tool?.name === 'string' ? tool.name : 'ocr', args);

  // Normalize typical MCP tool outputs
  if (isRecord(result)) {
    const contentVal = (result as Record<string, unknown>)['content'];
    if (Array.isArray(contentVal)) {
      const textParts = contentVal
        .map((c) => (isRecord(c) && c['type'] === 'text' && typeof c['text'] === 'string') ? (c['text'] as string) : null)
        .filter((v): v is string => v !== null);
      if (textParts.length) return textParts.join('\n');
    }
    const outputVal = (result as Record<string, unknown>)['output'];
    if (typeof outputVal === 'string') return outputVal as string;
    const possible = (result as Record<string, unknown>)['text']
      ?? (result as Record<string, unknown>)['data']
      ?? (result as Record<string, unknown>)['result'];
    if (typeof possible === 'string') return possible as string;
  }
  if (typeof result === 'string') return result;

  // Fallback: attempt common keys
  throw new Error('OCR result format not recognized.');
}

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const imageData = e.target?.result as string;
        const text = await extractTextFromImage(imageData);
        resolve(text);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
