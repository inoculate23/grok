import { useState, useRef, useEffect } from 'react';
import { Camera, X, Upload, Volume2, Loader2 } from 'lucide-react';
import { CameraCapture, extractTextFromFile, extractTextFromImage } from '../services/ocrService';
import { translateText, saveTranslation, speakText, LANGUAGES } from '../services/translationService';
import { VoiceSelector } from './VoiceSelector';
import { MarkdownPreview } from './MarkdownPreview';

export function CameraTranslator() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState('');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef(new CameraCapture());

  useEffect(() => {
    return () => {
      if (isCameraActive) {
        cameraRef.current.stopCamera();
      }
    };
  }, [isCameraActive]);

  const startCamera = async () => {
    try {
      const stream = await cameraRef.current.startCamera();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      alert('Failed to start camera. Please check your camera permissions.');
    }
  };

  const stopCamera = () => {
    cameraRef.current.stopCamera();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = async () => {
    if (!videoRef.current) return;

    try {
      setIsProcessing(true);
      const imageData = cameraRef.current.captureImage(videoRef.current);
      setCapturedImage(imageData);
      stopCamera();
      // Run OCR via MCP Space
      const text = await extractTextFromImage(imageData);
      setExtractedText(text);
      setIsProcessing(false);
    } catch (error) {
      console.error('Error capturing image:', error);
      alert('Failed to capture or process image.');
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await extractTextFromFile(file);
      const reader = new FileReader();
      reader.onload = () => setCapturedImage(reader.result as string);
      reader.readAsDataURL(file);
      setExtractedText(text);
      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image or run OCR.');
      setIsProcessing(false);
    }
  };

  const handleTranslate = async () => {
    if (!extractedText.trim()) return;

    setIsProcessing(true);
    try {
      const result = await translateText(extractedText, 'auto', targetLang);
      setTranslatedText(result);

      await saveTranslation(extractedText, result, 'auto', targetLang, 'camera');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Translation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-translate when extracted text changes, with simple debounce
  useEffect(() => {
    if (!autoTranslate) return;
    if (isProcessing) return;
    const text = extractedText.trim();
    if (!text) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setIsProcessing(true);
        try {
          const result = await translateText(text, 'auto', targetLang);
          setTranslatedText(result);
          await saveTranslation(text, result, 'auto', targetLang, 'camera');
        } catch (error) {
          console.error('Translation error:', error);
        } finally {
          setIsProcessing(false);
        }
      })();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [extractedText, targetLang, autoTranslate]);

  const handleSpeak = (text: string, lang: string) => {
    speakText(text, lang, voiceGender);
  };

  const handleReset = () => {
    setCapturedImage('');
    setExtractedText('');
    setTranslatedText('');
    setIsProcessing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Camera className="w-6 h-6 text-orange-600" />
          <h2 className="text-2xl font-bold text-gray-800">Camera Translation (OCR)</h2>
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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

      {!isCameraActive && !capturedImage && (
        <div className="flex gap-4 mb-6">
          <button
            onClick={startCamera}
            disabled={isProcessing}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Start Camera
          </button>

          <label className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-5 h-5" />
            Upload Image
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {isCameraActive && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-h-80"
            />
            <button
              onClick={stopCamera}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={captureImage}
            disabled={isProcessing}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Capture & Extract Text'
            )}
          </button>
        </div>
      )}

      {capturedImage && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <img src={capturedImage} alt="Captured" className="w-full max-h-80 object-contain" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extracted Text (Manual Input)
            </label>
            <textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Type the text from the image..."
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
            <MarkdownPreview content={extractedText} title="Rendered Preview" />
          </div>

          <button
            onClick={handleTranslate}
            disabled={isProcessing || !extractedText.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Translating...
              </>
            ) : (
              'Translate Text'
            )}
          </button>

          {translatedText && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Translation
                </label>
                <button
                  onClick={() => handleSpeak(translatedText, targetLang)}
                  className="text-orange-600 hover:text-orange-700 p-1"
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
