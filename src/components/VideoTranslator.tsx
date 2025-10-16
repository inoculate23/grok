import { useState, useRef, useEffect } from 'react';
import { Video, Upload, Volume2, Loader2 } from 'lucide-react';
import { translateText, saveTranslation, speakText, LANGUAGES } from '../services/translationService';
import { extractTextFromImage } from '../services/ocrService';
import { VoiceSelector } from './VoiceSelector';
import { MarkdownPreview } from './MarkdownPreview';

// Minimal typings for SpeechRecognition to avoid implicit any usage
type SpeechRecognitionAlternative = { transcript: string; confidence?: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultList = {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = { error: string; message?: string };
type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionType;

// Narrow navigator typing for Permissions API without using any
type NavigatorWithPermissions = Navigator & { permissions?: Permissions };

export function VideoTranslator() {
  const [transcribedText, setTranscribedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please upload a video file.');
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setTranscribedText('');
    setTranslatedText('');
  };

  const startTranscription = async () => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SR) {
      setStatusMessage('Speech recognition is not supported in this browser.');
      return;
    }

    if (!videoRef.current || !videoUrl) {
      setStatusMessage('Please upload and load a video first.');
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage('');

      // Best-effort permission hint for microphone (Web Speech API listens to mic only)
      try {
        const nav = navigator as NavigatorWithPermissions;
        const perms = nav.permissions;
        if (perms && typeof perms.query === 'function') {
          const res = await perms.query({ name: 'microphone' as PermissionName });
          if (res?.state === 'denied') {
            setStatusMessage('Microphone permission denied. Browser speech recognition listens to the microphone, not video audio.');
          }
        }
      } catch {
        // ignore permission query errors
      }

      recognitionRef.current = new SR();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      let finalTranscript = '';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        setTranscribedText(finalTranscript + interimTranscript);
      };

      recognitionRef.current.onend = async () => {
        if (finalTranscript) {
          await handleTranslate(finalTranscript.trim());
        } else {
          // No transcript captured — explain limitation clearly
          setStatusMessage('No speech captured. In-browser speech recognition only listens to your microphone, not the video audio. Try “Run OCR on Frames” for onscreen text, or play the video’s audio near your mic.');
        }
        setIsProcessing(false);
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setStatusMessage(`Speech recognition error: ${event.error}`);
        setIsProcessing(false);
      };

      recognitionRef.current.start();
      videoRef.current.play();

      videoRef.current.onended = () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    } catch (error) {
      console.error('Error starting transcription:', error);
      setStatusMessage('Failed to start transcription. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleTranslate = async (text: string) => {
    if (!text.trim()) return;

    try {
      const result = await translateText(text, 'auto', targetLang);
      setTranslatedText(result);

      await saveTranslation(text, result, 'auto', targetLang, 'video');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Translation failed. Please try again.');
    }
  };

  // Auto-translate on transcribed text changes with debounce
  useEffect(() => {
    if (!autoTranslate) return;
    if (isProcessing) return;
    const text = transcribedText.trim();
    if (!text) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await translateText(text, 'auto', targetLang);
          setTranslatedText(result);
          await saveTranslation(text, result, 'auto', targetLang, 'video');
        } catch (error) {
          console.error('Translation error:', error);
        }
      })();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [transcribedText, targetLang, autoTranslate, isProcessing]);

  // --- OCR from sampled video frames ---
  const drawFrameToDataUrl = (video: HTMLVideoElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  };

  const seekTo = (video: HTMLVideoElement, time: number) =>
    new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      const onError = () => {
        video.removeEventListener('error', onError);
        reject(new Error('Video seek error'));
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.currentTime = Math.max(0, Math.min(time, video.duration || time));
    });

  const runOcrOnFrames = async () => {
    const video = videoRef.current;
    if (!video || !video.duration || video.duration === Infinity) {
      alert('Load a video file first, then try OCR.');
      return;
    }

    try {
      setIsProcessing(true);
      const times = [0, 0.25, 0.5, 0.75, 0.95].map((p) => p * video.duration);
      const texts: string[] = [];
      for (const t of times) {
        await seekTo(video, t);
        const dataUrl = drawFrameToDataUrl(video);
        const text = await extractTextFromImage(dataUrl);
        if (text && !texts.includes(text)) texts.push(text);
      }
      const combined = texts.join('\n').trim();
      setTranscribedText(combined);
      if (combined) {
        await handleTranslate(combined);
      } else {
        alert('No text detected in sampled frames.');
      }
    } catch (err) {
      console.error('Video OCR error:', err);
      alert('Failed to run OCR on video frames.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    speakText(text, lang, voiceGender);
  };

  const handleReset = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVideoUrl('');
    setTranscribedText('');
    setTranslatedText('');
    setIsProcessing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Video className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800">Video Translation</h2>
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          {LANGUAGES.filter((lang) => lang.code !== 'auto').map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
          />
          Translate automatically
        </label>
      </div>

      <label className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer mb-6">
        <Upload className="w-5 h-5" />
        Upload Video
        <input
          type="file"
          accept="video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {videoUrl && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full max-h-80"
            />
          </div>

          <button
            onClick={startTranscription}
            disabled={isProcessing}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Start Transcription & Translation'
            )}
          </button>

          <button
            onClick={runOcrOnFrames}
            disabled={isProcessing}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing OCR...
              </>
            ) : (
              'Extract Text (OCR) from Frames'
            )}
          </button>

          {statusMessage && (
            <div className="text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-3">
              {statusMessage}
            </div>
          )}

          {transcribedText && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Transcribed Text
                </label>
                <button
                  onClick={() => handleSpeak(transcribedText, 'auto')}
                  className="text-purple-600 hover:text-purple-700 p-1"
                  title="Speak"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full min-h-20 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                {transcribedText}
              </div>
              <MarkdownPreview content={transcribedText} title="Rendered Preview" />
            </div>
          )}

          {translatedText && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Translation
                </label>
                <button
                  onClick={() => handleSpeak(translatedText, targetLang)}
                  className="text-purple-600 hover:text-purple-700 p-1"
                  title="Speak"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full min-h-20 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                {translatedText}
              </div>
              <MarkdownPreview content={translatedText} title="Rendered Preview" />
            </div>
          )}

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
