'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Navigation } from '@/components/layout/Navigation';
import { useStreamActions } from '@/hooks/useStreamActions';
import { parseAmount } from '@/lib/utils';
import { Loader2, Mail, Twitter, Wallet, ArrowRight, CheckCircle, ExternalLink } from 'lucide-react';

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
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { createStream, isLoading: isCreating } = useStreamActions();

  const [recipientType, setRecipientType] = useState<RecipientType>('email');
  const [recipientValue, setRecipientValue] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(DURATION_OPTIONS[1].seconds);
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'form' | 'signing' | 'confirming' | 'success'>('form');
  const [transactionResult, setTransactionResult] = useState<{
    streamId?: string;
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);

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

    const amountInOctas = parseAmount(amount);
    if (BigInt(amountInOctas) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setStep('signing');
    toast.info('Please sign the message in your wallet to authorize this stream');

    try {
      const result = await createStream({
        recipientType,
        recipientValue: recipientValue.replace('@', ''),
        amount: amountInOctas,
        durationSeconds: duration,
        message: message || undefined,
      });

      if (result.success && result.stream) {
        setStep('success');
        setTransactionResult({
          streamId: result.stream.id,
          txHash: result.transaction?.hash,
          explorerUrl: result.transaction?.explorerUrl,
        });
        
        toast.success('Stream created successfully!');
      } else {
        throw new Error(result.error || 'Failed to create stream');
      }
    } catch (error: any) {
      console.error('Failed to create stream:', error);
      toast.error(error.message || 'Failed to create stream');
      setStep('form');
    }
  };

  const handleViewStream = () => {
    if (transactionResult?.streamId) {
      router.push(`/claim/${transactionResult.streamId}`);
    }
  };

  const handleCreateAnother = () => {
    setStep('form');
    setRecipientValue('');
    setAmount('');
    setMessage('');
    setTransactionResult(null);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // Success view
  if (step === 'success' && transactionResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Stream Created!</h1>
            <p className="text-gray-600 mb-6">
              Your token stream has been created and is now active.
            </p>

            {transactionResult.txHash && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-500 mb-2">Transaction Hash</p>
                <a
                  href={transactionResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-violet-600 hover:text-violet-700 flex items-center justify-center gap-2"
                >
                  {transactionResult.txHash.slice(0, 20)}...{transactionResult.txHash.slice(-10)}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleViewStream}
                className="flex-1 bg-violet-600 text-white py-3 rounded-xl font-semibold hover:bg-violet-700 transition-colors"
              >
                View Stream
              </button>
              <button
                onClick={handleCreateAnother}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </main>
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
              Sending from: <span className="font-mono font-medium">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="space-y-6">
            {/* Recipient Type Selection */}
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
                    disabled={step !== 'form'}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      recipientType === type
                        ? 'border-violet-600 bg-violet-50 text-violet-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    } disabled:opacity-50`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Input */}
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
                disabled={step !== 'form'}
                placeholder={
                  recipientType === 'email'
                    ? 'friend@example.com'
                    : recipientType === 'twitter'
                    ? '@username'
                    : '0x...'
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none disabled:bg-gray-100"
              />
            </div>

            {/* Amount Input */}
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
                disabled={step !== 'form'}
                placeholder="100"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none disabled:bg-gray-100"
              />
            </div>

            {/* Duration Selection */}
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
                    disabled={step !== 'form'}
                    className={`p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                      duration === option.seconds
                        ? 'border-violet-600 bg-violet-50 text-violet-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    } disabled:opacity-50`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={step !== 'form'}
                placeholder="Happy birthday! 🎉"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none disabled:bg-gray-100"
              />
            </div>

            {/* Streaming Rate Preview */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCreating || step !== 'form'}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'signing' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Sign in Wallet...</span>
                </>
              ) : step === 'confirming' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Creating Stream...</span>
                </>
              ) : (
                <>
                  {authenticated ? 'Create Stream' : 'Connect to Continue'}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            {/* Info about signing */}
            {authenticated && step === 'form' && (
              <p className="text-center text-sm text-gray-500">
                You will be asked to sign a message to authorize this transaction.
                No gas fees required.
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}