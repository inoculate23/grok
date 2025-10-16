import { useState, useEffect } from 'react';
import { Type, Mic, Video, Camera, History, LogOut, MapPin, Bot } from 'lucide-react';
import { TextTranslator } from './components/TextTranslator';
import { AudioTranslator } from './components/AudioTranslator';
import { VideoTranslator } from './components/VideoTranslator';
import { CameraTranslator } from './components/CameraTranslator';
import { TranslationHistory } from './components/TranslationHistory';
import { TourGuide } from './components/TourGuide.tsx';
import { ChatGPTTab } from './components/ChatGPTTab.tsx';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { CheckoutPage } from './components/CheckoutPage';
import { useAuth } from './hooks/useAuth';
import { usePurchase } from './hooks/usePurchase';
import { supabase } from './lib/supabase';

type Tab = 'text' | 'audio' | 'video' | 'camera' | 'history' | 'tour' | 'chatgpt';
type View = 'landing' | 'checkout' | 'app';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [view, setView] = useState<View>('landing');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { hasPurchased, loading: purchaseLoading } = usePurchase(user?.id, user?.email || undefined);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demo = urlParams.get('demo');
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');
    const processedSessionId = sessionStorage.getItem('processed_session_id');

    // Demo mode bypass to enable automated screenshots without auth/purchase
    if (demo === '1') {
      setView('app');
      return;
    }

    const handleSuccessReturn = async () => {
      if (success === 'true' && sessionId && user) {
        try {
          if (processedSessionId === sessionId) {
            window.history.replaceState({}, '', '/');
            setView('app');
            return;
          }
          const { data: existingPurchase } = await supabase
            .from('purchases')
            .select('id')
            .eq('user_id', user.id)
            .eq('stripe_session_id', sessionId)
            .maybeSingle();

          if (!existingPurchase) {
            sessionStorage.setItem('processed_session_id', sessionId);
            console.log('Payment successful, webhook will record the purchase.');
          }

          window.history.replaceState({}, '', '/');
          setView('app');
        } catch (error) {
          console.error('Error handling success return:', error);
        }
      }
    };

    if (success === 'true' && sessionId && user && !hasPurchased) {
      if (processedSessionId === sessionId) {
        window.history.replaceState({}, '', '/');
        setView('app');
        return;
      }
      // Mark as processed synchronously to prevent StrictMode double-invocation races
      sessionStorage.setItem('processed_session_id', sessionId);
      handleSuccessReturn();
      return;
    }

    if (!authLoading && !purchaseLoading) {
      if (!user) {
        setView('landing');
      } else if (!hasPurchased) {
        setView('checkout');
      } else {
        setView('app');
      }
    }
  }, [user, hasPurchased, authLoading, purchaseLoading]);

  const handleGetStarted = () => {
    if (!user) {
      setShowAuthModal(true);
    } else if (!hasPurchased) {
      setView('checkout');
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      localStorage.clear();
      setView('landing');
      window.location.reload();
    }
  };

  if (authLoading || purchaseLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onGetStarted={handleGetStarted}
          isLoggedIn={!!user}
          onSignOut={handleSignOut}
        />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  if (view === 'checkout') {
    return (
      <CheckoutPage
        onBack={handleSignOut}
        userEmail={user?.email || ''}
      />
    );
  }

  const tabs = [
    { id: 'text' as Tab, label: 'Text', icon: Type },
    { id: 'audio' as Tab, label: 'Audio', icon: Mic },
    { id: 'video' as Tab, label: 'Video', icon: Video },
    { id: 'camera' as Tab, label: 'Camera', icon: Camera },
    { id: 'history' as Tab, label: 'History', icon: History },
    { id: 'tour' as Tab, label: 'Tour Guide', icon: MapPin },
    { id: 'chatgpt' as Tab, label: 'ChatGPT', icon: Bot },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/earth.svg" alt="Earth" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Grok</h1>
                <p className="text-gray-600 text-lg">
                  Translate text, audio, video, and images with speech output
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex gap-2 border-b border-gray-200 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {activeTab === 'text' && <TextTranslator />}
            {activeTab === 'audio' && <AudioTranslator />}
            {activeTab === 'video' && <VideoTranslator />}
            {activeTab === 'camera' && <CameraTranslator />}
            {activeTab === 'history' && <TranslationHistory />}
            {activeTab === 'tour' && <TourGuide />}
            {activeTab === 'chatgpt' && <ChatGPTTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
