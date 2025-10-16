import { supabase } from '../lib/supabase';
// Toggle server-side history interactions. Local client history is always enabled.
const HISTORY_ENABLED = (import.meta.env.VITE_ENABLE_TRANSLATION_HISTORY === 'true');

// Derive a projectRef to scope storage keys per Supabase project
const projectRef = (() => {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    return new URL(url).hostname.split('.')[0] || 'default';
  } catch {
    return 'default';
  }
})();

const CLIENT_ID_STORAGE_KEY = `universal-translator-client-id-${projectRef}`;
const historyKeyForClient = (clientId: string) =>
  `universal-translator-history-${projectRef}-${clientId}`;

// IndexedDB helpers for structured, per-client history
function getIndexedDB(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request error'));
  });
}

async function openHistoryDB(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) throw new Error('IndexedDB not available');
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(`universal-translator-history-${projectRef}`, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore('historyItems', { keyPath: 'id' });
      store.createIndex('client_id', 'client_id');
      // Composite index to efficiently fetch by client and sort by created_at
      store.createIndex('client_created_at', ['client_id', 'created_at']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function safeRandomUUID(): string | null {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string };
    return typeof c?.randomUUID === 'function' ? c.randomUUID() : null;
  } catch {
    return null;
  }
}

async function getClientId(): Promise<string> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch {
    // ignore auth lookup errors, fall back to anonymous client id
  }

  let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!id) {
    const gen = safeRandomUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    id = `anon-${gen}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  }
  return id;
}

type LocalTranslationItem = {
  id: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  translation_type: 'text' | 'audio' | 'video' | 'camera';
  created_at: string;
};

// Internal record shape used in IndexedDB with client scoping
type LocalTranslationRecord = LocalTranslationItem & { client_id: string };

function omitClientId(rec: LocalTranslationRecord): LocalTranslationItem {
  const {
    id,
    source_text,
    translated_text,
    source_language,
    target_language,
    translation_type,
    created_at,
  } = rec;
  return {
    id,
    source_text,
    translated_text,
    source_language,
    target_language,
    translation_type,
    created_at,
  };
}

// localStorage fallback
function readLocalHistory(clientId: string): LocalTranslationItem[] {
  const key = historyKeyForClient(clientId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(clientId: string, items: LocalTranslationItem[]): void {
  const key = historyKeyForClient(clientId);
  localStorage.setItem(key, JSON.stringify(items));
}

async function idbPutHistoryItem(clientId: string, item: LocalTranslationItem): Promise<void> {
  const db = await openHistoryDB();
  const tx = db.transaction('historyItems', 'readwrite');
  const store = tx.objectStore('historyItems');
  const record = { ...item, client_id: clientId } as LocalTranslationRecord;
  await reqToPromise(store.put(record));
}

async function idbGetClientHistory(clientId: string, limit: number): Promise<LocalTranslationItem[]> {
  const db = await openHistoryDB();
  const tx = db.transaction('historyItems', 'readonly');
  const index = tx.objectStore('historyItems').index('client_created_at');
  const range = IDBKeyRange.bound([clientId, ''], [clientId, '\uffff']);
  const out: LocalTranslationItem[] = [];
  return new Promise<LocalTranslationItem[]>((resolve, reject) => {
    const cursorRequest = index.openCursor(range, 'prev');
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor && out.length < limit) {
        const value = cursor.value as LocalTranslationRecord;
        out.push(omitClientId(value));
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('Cursor error'));
  });
}

async function idbClearClientHistory(clientId: string): Promise<void> {
  const db = await openHistoryDB();
  const tx = db.transaction('historyItems', 'readwrite');
  const index = tx.objectStore('historyItems').index('client_id');
  const range = IDBKeyRange.only(clientId);
  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor(range);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('Cursor error'));
  });
}

export const LANGUAGES = [
  { code: 'auto', name: 'Auto Detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
];

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url);
    const raw: unknown = await response.json();
    return parseGoogleTranslateResponse(raw);
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

function parseGoogleTranslateResponse(raw: unknown): string {
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const sentences = raw[0] as unknown[];
    const parts: string[] = [];
    for (const s of sentences) {
      if (Array.isArray(s) && typeof s[0] === 'string') {
        parts.push(s[0]);
      }
    }
    if (parts.length > 0) {
      return parts.join('');
    }
  }
  throw new Error('Translation failed');
}

export async function saveTranslation(
  sourceText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string,
  type: 'text' | 'audio' | 'video' | 'camera'
) {
  // Always save to client-scoped local history first
  const clientId = await getClientId();
  const item: LocalTranslationItem = {
    id: safeRandomUUID() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source_text: sourceText,
    translated_text: translatedText,
    source_language: sourceLang,
    target_language: targetLang,
    translation_type: type,
    created_at: new Date().toISOString(),
  };
  // Write to IndexedDB; fallback to localStorage if not available
  try {
    await idbPutHistoryItem(clientId, item);
  } catch {
    const existing = readLocalHistory(clientId);
    writeLocalHistory(clientId, [item, ...existing].slice(0, 200));
  }

  // Optionally mirror to server if enabled; ignore failures
  if (HISTORY_ENABLED) {
    try {
      const { error } = await supabase
        .from('translations')
        .insert({
          source_text: sourceText,
          translated_text: translatedText,
          source_language: sourceLang,
          target_language: targetLang,
          translation_type: type,
        });
      if (error) {
        if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
          console.warn('RLS prevented saving translation on server. Using local history only.');
        } else {
          console.warn('Server history save failed; continuing with local history:', error.message);
        }
      }
    } catch (err) {
      console.warn('Server history save errored; continuing locally:', err);
    }
  }

  return item;
}

export async function getTranslationHistory(limit: number = 50) {
  // Read from client-scoped IndexedDB; fallback to localStorage
  const clientId = await getClientId();
  try {
    return await idbGetClientHistory(clientId, limit);
  } catch {
    const items = readLocalHistory(clientId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
    return items;
  }
}

export async function clearTranslationHistory() {
  // Clear client-scoped local history
  const clientId = await getClientId();
  try {
    await idbClearClientHistory(clientId);
  } catch {
    // fallback to localStorage
    try {
      localStorage.removeItem(historyKeyForClient(clientId));
    } catch (lsErr) {
      console.warn('Failed to clear local history fallback:', lsErr);
    }
  }
  // Optionally attempt server-side clear, but ignore errors
  if (HISTORY_ENABLED) {
    try {
      const { error } = await supabase
        .from('translations')
        .delete()
        .gte('id', 0);
      if (error) {
        if (error.code === '42501' || /row-level security|permission/i.test(error.message || '')) {
          console.warn('RLS prevented clearing server history. Ignoring.');
        }
      }
    } catch (err) {
      console.debug('Server history clear errored; ignored', err);
    }
  }
}

export function getAvailableVoices(lang: string): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];

  const voices = window.speechSynthesis.getVoices();
  return voices.filter(voice => voice.lang.startsWith(lang));
}

export function getMaleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices(lang);
  return voices.find(voice =>
    voice.name.toLowerCase().includes('male') ||
    voice.name.toLowerCase().includes('david') ||
    voice.name.toLowerCase().includes('james') ||
    voice.name.toLowerCase().includes('thomas')
  ) || voices[0] || null;
}

export function getFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices(lang);
  return voices.find(voice =>
    voice.name.toLowerCase().includes('female') ||
    voice.name.toLowerCase().includes('samantha') ||
    voice.name.toLowerCase().includes('victoria') ||
    voice.name.toLowerCase().includes('karen')
  ) || voices[1] || voices[0] || null;
}

export function speakText(text: string, lang: string, voiceGender: 'male' | 'female' = 'female') {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = voiceGender === 'female' ? 1.1 : 0.75;

    const voice = voiceGender === 'male' ? getMaleVoice(lang) : getFemaleVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }
}
