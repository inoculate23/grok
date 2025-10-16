import { useState } from 'react';
import { CreditCard, Shield, Check, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CheckoutPageProps {
  onBack: () => void;
  userEmail: string;
}

export function CheckoutPage({ onBack, userEmail }: CheckoutPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Please sign out and sign in again to continue');
      }

      if (!session.access_token) {
        throw new Error('Invalid session. Please sign in again');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Checkout error:', data);
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (data.url) {
        console.log('Opening Stripe checkout in new tab:', data.url);
        const popup = window.open(data.url, '_blank');
        if (!popup) {
          throw new Error('Please allow popups to complete checkout');
        }
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Lifetime access to all translation features',
    'Text, audio, video, and camera translation',
    'Support for 17 languages',
    'Unlimited translations',
    'Translation history and management',
    'Male and female voice options',
    'Priority customer support',
    'Free updates forever',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
          <div className="flex items-center gap-2">
            <img src="/earth.svg" alt="Earth" className="h-8 w-8 object-contain" />
            <span className="text-xl font-bold text-gray-900">Grok</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
            <p className="text-blue-100">
              You're one step away from unlimited translations
            </p>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  What's Included
                </h2>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-1 mt-0.5">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Order Summary
                  </h3>
                  <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product</span>
                      <span className="font-semibold text-gray-900">
                        Grok
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">License</span>
                      <span className="font-semibold text-gray-900">Lifetime</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account</span>
                      <span className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">
                        {userEmail}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-blue-600">$29.00</span>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                >
                  <CreditCard className="w-5 h-5" />
                  {loading ? 'Processing...' : 'Proceed to Secure Checkout'}
                </button>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>Secure payment powered by Stripe</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <span>Powered by</span>
                    <a href="https://haawke.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-gray-700 transition-colors">
              <img src="/earth.svg" alt="Earth" className="h-4 w-4 object-contain" />
                      <span className="font-semibold">Haawke AI</span>
                    </a>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    30-Day Money-Back Guarantee
                  </h4>
                  <p className="text-sm text-gray-600">
                    Not satisfied? Get a full refund within 30 days, no questions
                    asked.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
