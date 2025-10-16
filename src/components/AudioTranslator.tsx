import { useState, useRef } from 'react';
import { Mic, Square, Upload, Volume2, Loader2 } from 'lucide-react';
import { AudioRecorder } from '../services/audioService';
import { translateText, saveTranslation, speakText, LANGUAGES } from '../services/translationService';
import { VoiceSelector } from './VoiceSelector';

export function AudioTranslator() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const audioRecorderRef = useRef(new AudioRecorder());
  const recognitionRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in your browser.');
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setTranscribedText(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);

      if (transcribedText) {
        await handleTranslate(transcribedText);
      }
    }
  };

  const handleTranslate = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    try {
      const result = await translateText(text, 'auto', targetLang);
      setTranslatedText(result);

      await saveTranslation(text, result, 'auto', targetLang, 'audio');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Translation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please upload an audio file.');
      return;
    }

    alert('Audio file transcription requires additional setup. Please use the microphone recording feature instead.');
  };

  const handleSpeak = (text: string, lang: string) => {
    speakText(text, lang, voiceGender);
  };

  const handleReset = () => {
    setTranscribedText('');
    setTranslatedText('');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Mic className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-800">Audio Translation</h2>
        </div>
        <VoiceSelector value={voiceGender} onChange={setVoiceGender} />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Translate To
        </label>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4 mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 animate-pulse"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </button>
        )}

        <label className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <Upload className="w-5 h-5" />
          Upload Audio
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {(transcribedText || translatedText) && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Transcribed Text
              </label>
              {transcribedText && (
                <button
                  onClick={() => handleSpeak(transcribedText, 'auto')}
                  className="text-green-600 hover:text-green-700 p-1"
                  title="Speak"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="w-full min-h-20 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
              {transcribedText || <span className="text-gray-400">Speak to transcribe...</span>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Translation
              </label>
              {translatedText && (
                <button
                  onClick={() => handleSpeak(translatedText, targetLang)}
                  className="text-green-600 hover:text-green-700 p-1"
                  title="Speak"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="w-full min-h-20 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
              {isProcessing ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Translating...
                </div>
              ) : (
                translatedText || <span className="text-gray-400">Translation will appear here...</span>
              )}
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
