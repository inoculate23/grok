import { useState } from 'react';
import { Languages, Volume2, Loader2 } from 'lucide-react';
import { translateText, saveTranslation, speakText, LANGUAGES } from '../services/translationService';
import { VoiceSelector } from './VoiceSelector';

export function TextTranslator() {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [isTranslating, setIsTranslating] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    setIsTranslating(true);
    try {
      const result = await translateText(sourceText, sourceLang, targetLang);
      setTranslatedText(result);

      await saveTranslation(sourceText, result, sourceLang, targetLang, 'text');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    speakText(text, lang, voiceGender);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Languages className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Text Translation</h2>
        </div>
        <VoiceSelector value={voiceGender} onChange={setVoiceGender} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Source Text
            </label>
            {sourceText && (
              <button
                onClick={() => handleSpeak(sourceText, sourceLang)}
                className="text-blue-600 hover:text-blue-700 p-1"
                title="Speak"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Translation
            </label>
            {translatedText && (
              <button
                onClick={() => handleSpeak(translatedText, targetLang)}
                className="text-blue-600 hover:text-blue-700 p-1"
                title="Speak"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 overflow-y-auto">
            {translatedText || (
              <span className="text-gray-400">Translation will appear here...</span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleTranslate}
        disabled={isTranslating || !sourceText.trim()}
        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isTranslating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Translating...
          </>
        ) : (
          'Translate'
        )}
      </button>
    </div>
  );
}
