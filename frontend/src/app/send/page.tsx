'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Navigation } from '@/components/layout/Navigation';
import { api } from '@/lib/api';
import { parseAmount } from '@/lib/utils';
import { Loader2, Mail, Twitter, Wallet, ArrowRight } from 'lucide-react';

type RecipientType = 'email' | 'twitter' | 'wallet';

interface DurationOption {
  label: string;
  seconds: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: '1 hour', seconds: 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
];

export default function SendPage() {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  const [recipientType, setRecipientType] = useState<RecipientType>('email');
  const [recipientValue, setRecipientValue] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(DURATION_OPTIONS[1].seconds);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Get the first available wallet address
  const walletAddress = wallets?.[0]?.address;

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!authenticated) {
    login();
    return;
  }

  if (!walletAddress) {
    toast.error('No wallet found. Please reconnect your account.');
    return;
  }

  if (!recipientValue || !amount) {
    toast.error('Please fill in all required fields');
    return;
  }

  setLoading(true);

  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const response = await api.streams.create(
      {
        recipientType,
        recipientValue: recipientValue.replace('@', ''),
        amount: parseAmount(amount),
        durationSeconds: duration,
        message: message || undefined,
        senderAddress: walletAddress,  // Add this line
      },
      token
    );

    toast.success('Stream created successfully!');
    router.push(`/claim/${response.stream.id}`);
  } catch (error: any) {
    toast.error(error.message || 'Failed to create stream');
  } finally {
    setLoading(false);
  }
};

  
   

    

     
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Send a Stream</h1>
          <p className="text-gray-600 mt-2">
            Stream tokens continuously to anyone
          </p>
        </div>

        {authenticated && walletAddress && (
          <div className="mb-6 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            <p className="text-sm text-violet-700">
              Sending from: <span className="font-mono font-medium">{walletAddress}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Recipient Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: 'email' as const, icon: Mail, label: 'Email' },
                  { type: 'twitter' as const, icon: Twitter, label: 'Twitter' },
                  { type: 'wallet' as const, icon: Wallet, label: 'Wallet' },
                ].map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRecipientType(type)}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      recipientType === type
                        ? 'border-violet-600 bg-violet-50 text-violet-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {recipientType === 'email' && 'Email Address'}
                {recipientType === 'twitter' && 'Twitter Handle'}
                {recipientType === 'wallet' && 'Wallet Address'}
              </label>
              <input
                type={recipientType === 'email' ? 'email' : 'text'}
                value={recipientValue}
                onChange={(e) => setRecipientValue(e.target.value)}
                placeholder={
                  recipientType === 'email'
                    ? 'friend@example.com'
                    : recipientType === 'twitter'
                    ? '@username'
                    : '0x...'
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (MOVE)
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Duration
              </label>
              <div className="grid grid-cols-4 gap-3">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.seconds}
                    type="button"
                    onClick={() => setDuration(option.seconds)}
                    className={`p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                      duration === option.seconds
                        ? 'border-violet-600 bg-violet-50 text-violet-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Happy birthday! 🎉"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
              />
            </div>

            {amount && duration && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600">
                  Streaming rate:{' '}
                  <span className="font-semibold text-gray-900">
                    {(parseFloat(amount) / duration).toFixed(6)} MOVE/second
                  </span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {authenticated ? 'Create Stream' : 'Connect to Continue'}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}