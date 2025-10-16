/// <reference types="react" />
import * as React from 'react';
import { Client } from '@gradio/client';
import { MarkdownPreview } from './MarkdownPreview';

type ChatTurn = { role: 'user' | 'assistant'; content: string };
type GradioClientOptions = { hf_token: `hf_${string}` };

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function isChatTurn(val: unknown): val is ChatTurn {
  if (!isRecord(val)) return false;
  const role = val['role'];
  const content = val['content'];
  return (role === 'user' || role === 'assistant') && typeof content === 'string';
}

function getInitialSpace(): string {
  const stored = localStorage.getItem('hf_space');
  if (stored) return stored;
  const env = import.meta.env.VITE_GRADIO_SPACE as string | undefined;
  return env ?? 'tencent/hunyuan-turbos';
}

function getInitialToken(): string {
  const stored = localStorage.getItem('hf_token');
  return stored ?? '';
}

export function ChatGPTTab() {
  const [space, setSpace] = React.useState<string>(getInitialSpace());
  const [token, setToken] = React.useState<string>(getInitialToken());
  const [message, setMessage] = React.useState<string>('Hello!!');
  const [chat, setChat] = React.useState<ChatTurn[]>(() => {
    try {
      const raw = sessionStorage.getItem('hf_chat');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter(isChatTurn);
      return [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    localStorage.setItem('hf_space', space);
  }, [space]);

  React.useEffect(() => {
    if (token) localStorage.setItem('hf_token', token);
  }, [token]);

  // Persist chat in session for this tab session
  React.useEffect(() => {
    try {
      sessionStorage.setItem('hf_chat', JSON.stringify(chat));
    } catch {
      // ignore storage errors
    }
  }, [chat]);

  const send = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const normalizedSpace = space.trim();
      const normalizedToken = token.trim();

      let opts: GradioClientOptions | undefined = undefined;
      if (normalizedToken) {
        if (!normalizedToken.startsWith('hf_')) {
          setError('HF token must start with "hf_".');
          setLoading(false);
          return;
        }
        opts = { hf_token: normalizedToken as `hf_${string}` };
      }

      // Add user message to the chat before sending
      setChat((prev: ChatTurn[]) => [...prev, { role: 'user', content: message }]);

      const client = await Client.connect(normalizedSpace, opts);
      const result = await client.predict('/chat', { message });
      const data = (result as { data?: unknown }).data;
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      setChat((prev: ChatTurn[]) => [...prev, { role: 'assistant', content: text }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Chat request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Chat (Hugging Face Space)</h3>
        <p className="text-sm text-gray-600">Provide a Space ID and, if private, your Hugging Face token. Then send a message using the Space’s <code>/chat</code> API.</p>
      </div>

      <div className="bg-slate-50 border rounded-lg p-3 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-700">Space ID</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="owner/space (e.g. tencent/hunyuan-turbos)"
              value={space}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpace(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">HF Token (if required)</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="hf_xxx"
              value={token}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-700">Message</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Hello!!"
            value={message}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={send}
            disabled={loading || !space}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >{loading ? 'Sending…' : 'Send'}</button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div className="border rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Conversation</label>
          <button
            onClick={() => setChat([])}
            className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
            disabled={chat.length === 0}
          >Clear</button>
        </div>
        {chat.length === 0 ? (
          <p className="text-sm text-gray-600">No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {chat.map((turn: ChatTurn, idx: number) => (
              <div
                key={idx}
                className={
                  turn.role === 'user'
                    ? 'bg-blue-50 border border-blue-100 rounded-lg p-3'
                    : 'bg-gray-50 border border-gray-200 rounded-lg p-3'
                }
              >
                <div className="text-xs font-semibold text-gray-600 mb-1">
                  {turn.role === 'user' ? 'You' : 'Assistant'}
                </div>
                {turn.role === 'user' ? (
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">{turn.content}</div>
                ) : (
                  <MarkdownPreview content={turn.content} title="" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}