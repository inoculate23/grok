import { Check, Languages, Mic, Video, Camera, Zap, Shield, MapPin } from 'lucide-react';
import * as React from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
  isLoggedIn?: boolean;
  onSignOut?: () => void;
}

export function LandingPage({ onGetStarted, isLoggedIn, onSignOut }: LandingPageProps) {
  // Lazy-load hero video to avoid premature network requests that can be aborted
  const [showHeroVideo, setShowHeroVideo] = React.useState(false);
  const heroContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = heroContainerRef.current;
    if (!el || showHeroVideo) return;
    const obs = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          setShowHeroVideo(true);
          obs.disconnect();
        }
      },
      { root: null, threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [showHeroVideo]);

  // Cloudflare Stream: new hero video ID from provided watch URL
  const heroVideoId = 'ac4567de64e4b294c140ede089424379';
  const posterUrl =`https://customer-2ml6p4cr5a93a3wc.cloudflarestream.com/${heroVideoId}/thumbnails/thumbnail.jpg?time=0h0m05s&height=600`;
  const cloudflareSrc = showHeroVideo
    ? `https://customer-2ml6p4cr5a93a3wc.cloudflarestream.com/${heroVideoId}/iframe?muted=true&loop=true&poster=${encodeURIComponent(
        posterUrl
      )}&preload=none&autoplay=false&startTime=0s`
    : undefined;
  const features = [
    {
      icon: Languages,
      title: 'Text Translation',
      description: 'Translate text between 17 languages instantly with high accuracy',
    },
    {
      icon: Mic,
      title: 'Audio Translation',
      description: 'Record audio and get real-time translation with speech synthesis',
    },
    {
      icon: Video,
      title: 'Video Translation',
      description: 'Upload videos and receive translated subtitles and audio',
    },
    {
      icon: Camera,
      title: 'Camera Translation',
      description: 'Point your camera at text and get instant translations',
    },
    {
      icon: MapPin,
      title: 'Tour Guide',
      description: 'Location-aware recommendations with map, directions, and landmark recognition',
    },
  ];

  const benefits = [
    'Support for 17 languages: English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi, Dutch, Polish, Turkish, Thai, and Vietnamese',
    'Real-time speech-to-text and text-to-speech conversion',
    'Translation history with search and filter capabilities',
    'Male and female voice options for audio playback',
    'Secure cloud storage for all your translations',
    'High-accuracy OCR for camera and image translations',
    'Tour Guide: GPS-aware nearby places, interactive map, and directions',
  ];

  const integrations = [
    {
      name: 'Google Translate API',
      description: 'Industry-leading translation accuracy',
    },
    {
      name: 'Web Speech API',
      description: 'Native browser speech recognition',
    },
    {
      name: 'Tesseract OCR',
      description: 'Advanced optical character recognition',
    },
    {
      name: 'Supabase',
      description: 'Secure cloud database and authentication',
    },
  ];

  const featurePalette = [
    { cardBorder: 'border-orange-400', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
    { cardBorder: 'border-green-400', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
    { cardBorder: 'border-purple-400', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { cardBorder: 'border-sky-400', iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/earth.svg" alt="Earth" className="h-10 w-10 object-contain" />
              <span className="text-2xl font-bold text-gray-900">Grok: Agentic Travel Assistant</span>
            </div>
            {(
              <>
                {isLoggedIn ? (
                  <button
                    onClick={onSignOut}
                    className="bg-white text-gray-800 border border-gray-300 px-6 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={onGetStarted}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <span className="font-kalam text-5xl md:text-6xl font-bold text-blue-600 mb-4">
              Grok: to understand something completely and intuitively — at a deep level.
            </span>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
          
            <h1 className="text-5xl md:text-6xl text-gray-900 mb-6">
              {['Break', 'Language', 'Barriers'].map((w, i) => (
                <span
                  key={`l1-${i}`}
                  className="fade-up-word mr-2"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  {w}
                </span>
              ))}
              <br />
              {['Anywhere,', 'Anytime'].map((w, i) => (
                <span
                  key={`l2-${i}`}
                  className="fade-up-word text-blue-600 mr-2"
                  style={{ animationDelay: `${(3 + i) * 200}ms` }}
                >
                  {w}
                </span>
              ))}
            </h1>
            <p className="text-xl text-gray-600 mb-10">
              The difference between an unforgettable vacation or a successful business trip often
              comes down to language — understanding it deeply. Grok is the most powerful
              translation tool with text, audio, video, and camera support. </p>
              <p  className="text-xl text-gray-600 mb-10">
                 When traveling, grokking local language and context helps you read signs, navigate transit, order food, and connect with
              people beyond literal translation. Grok turns those moments into confident decisions in real
              time across 17 languages.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
              <button
                onClick={onGetStarted}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
              >
                Start Translating - $29 Lifetime Access
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield className="w-5 h-5 text-green-600" />
                <span>Secure payment via Stripe</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <div
              className="relative w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl"
              style={{ paddingTop: '56.25%', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
              ref={heroContainerRef}
            >
              {showHeroVideo ? (
                <video
                  muted
                  autoPlay
                  loop
                  playsInline
                  controls={false}
                  preload="metadata"
                  poster={posterUrl}
                  style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', objectFit: 'cover' }}
                >
                  <source src="/demo/hero.mp4" type="video/mp4" />
                </video>
              ) : cloudflareSrc ? (
                <iframe
                  src={cloudflareSrc}
                  loading="lazy"
                  style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  title="Grok hero"
                />
              ) : (
                <img
                  src={posterUrl}
                  alt="Grok hero preview"
                  style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-baloo text-4xl font-bold text-center text-gray-900 mb-12">
          Powerful Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const color = featurePalette[index % featurePalette.length];
            return (
              <div
                key={index}
                className={`bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow border ${color.cardBorder}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${color.iconBg}`}>
                  <feature.icon className={`w-6 h-6 ${color.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add demo video within Powerful Features section */}
      

      {/* Featured Illustration Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
     
   
        {/* Embedded Product Demo within Features */}
        <div className="mt-12">
          <h2 className="font-baloo text-4xl font-bold text-center text-gray-900 mb-12">
           Product Features
          </h2>
          <div className="flex justify-center">
            <div
              className="relative w-full max-w-5xl rounded-xl overflow-hidden shadow-2xl bg-white"
              style={{ paddingTop: '56.25%', boxShadow: '10px 20px 50px rgba(0,0,145,0.35)' }}
            >
                <iframe
                  src="https://customer-2ml6p4cr5a93a3wc.cloudflarestream.com/3b1ce05d3076bdd2a2382f8b11bdf4a1/iframe?preload=true&poster=https%3A%2F%2Fcustomer-2ml6p4cr5a93a3wc.cloudflarestream.com%2F3b1ce05d3076bdd2a2382f8b11bdf4a1%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D0h0m01s%26height%3D600&startTime=0h0m0s&primaryColor=%2340a5f2"
                 
                  loading="lazy"
                  style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%', transform: 'scale(1.04)', transformOrigin: 'center' }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                />
            </div>
          </div>
        </div>
      </section>

      {/* Combined Clip section removed as requested */}

      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-baloo text-4xl font-bold text-center text-gray-900 mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="bg-green-100 rounded-full p-1 mt-1">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-baloo text-4xl font-bold text-center text-gray-900 mb-4">
          Powered by Industry Leaders
        </h2>
        <p className="text-center text-gray-600 mb-12 text-lg">
          We integrate with the best technologies to deliver exceptional results
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">{integration.name}</h3>
              </div>
              <p className="text-gray-600 text-sm">{integration.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-baloo text-4xl font-bold text-white mb-6">
            Ready to Start Translating?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Get lifetime access to all features for a one-time payment
          </p>
          <button
            onClick={onGetStarted}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-all transform hover:scale-105 shadow-xl"
          >
            Purchase Now - $29
          </button>
          <p className="text-blue-100 mt-4 text-sm">
            30-day money-back guarantee • Secure checkout
          </p>
        </div>
      </section>

      {/* Contact Form (Netlify-detected) */}
      <section className="bg-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-baloo text-3xl font-bold text-center text-gray-900 mb-8">Contact Us</h2>
          <form
            name="contact"
            method="POST"
            data-netlify="true"
            data-netlify-honeypot="bot-field"
            className="bg-white rounded-xl p-6 shadow-lg border border-gray-200"
          >
            <input type="hidden" name="form-name" value="contact" />
            {/* Honeypot field */}
            <div className="hidden">
              <label>
                Don’t fill this out if you're human:
                <input name="bot-field" />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-center">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Send Message
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm">Powered by</span>
            <a href="https://haawke.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
              <img src="/earth.svg" alt="Earth" className="h-6 w-6 object-contain" />
              <span className="font-semibold">Haawke AI</span>
            </a>
          </div>
          <div className="text-sm text-gray-300">
            <span className="block font-medium">Haawke AI</span>
            <span className="block">23600 Mercantile Road</span>
            <span className="block">Suite C-100 Postbox CE027211</span>
            <span className="block">Beachwood, OH, 44122</span>
            <span className="block">USA</span>
          </div>
          <p>&copy; 2025 Haawke / Inoculate Media. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
