import { useState, useEffect } from 'react';
import { History, Volume2, Trash2 } from 'lucide-react';
import { getTranslationHistory, speakText, clearTranslationHistory } from '../services/translationService';
import { Translation } from '../lib/supabase';
import { VoiceSelector } from './VoiceSelector';

export function TranslationHistory() {
  const [history, setHistory] = useState<Translation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getTranslationHistory();
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory =
    filter === 'all'
      ? history
      : history.filter((item) => item.translation_type === filter);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-800';
      case 'audio':
        return 'bg-green-100 text-green-800';
      case 'video':
        return 'bg-purple-100 text-purple-800';
      case 'camera':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    speakText(text, lang, voiceGender);
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all translation history? This action cannot be undone.')) {
      return;
    }

    try {
      await clearTranslationHistory();
      setHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
      alert('Failed to clear history. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-800">Translation History</h2>
        </div>
        <div className="flex items-center gap-4">
          <VoiceSelector value={voiceGender} onChange={setVoiceGender} />
          <button
            onClick={loadHistory}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh
          </button>
          <button
            onClick={handleClearHistory}
            disabled={history.length === 0}
            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
            title="Clear all history"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Type
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="text">Text</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="camera">Camera</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading history...</div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No translation history yet. Start translating to see your history here.
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${getTypeColor(
                    item.translation_type
                  )}`}
                >
                  {item.translation_type.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">
                      Source ({item.source_language})
                    </label>
                    <button
                      onClick={() => handleSpeak(item.source_text, item.source_language)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="Speak"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                    {item.source_text}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">
                      Translation ({item.target_language})
                    </label>
                    <button
                      onClick={() =>
                        handleSpeak(item.translated_text, item.target_language)
                      }
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="Speak"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                    {item.translated_text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
