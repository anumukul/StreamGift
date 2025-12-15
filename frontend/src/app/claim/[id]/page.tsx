'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { Navigation } from '@/components/layout/Navigation';
import { StreamTicker } from '@/components/stream/StreamTicker';
import { StreamProgress } from '@/components/stream/StreamProgress';
import { api } from '@/lib/api';
import { formatAmount, shortenAddress, formatDuration } from '@/lib/utils';
import { Loader2, User, Calendar, MessageSquare, CheckCircle, Share2, Copy } from 'lucide-react';

interface StreamData {
  id: string;
  onChainId: number;
  sender: string;
  recipient: string;
  recipientSocial: { type: string; handle: string } | null;
  totalAmount: string;
  claimedAmount: string;
  claimable: string;
  ratePerSecond: string;
  startTime: string;
  endTime: string;
  message: string | null;
  status: string;
}

export default function ClaimPage() {
  const params = useParams();
  const streamId = params.id as string;

  const { ready, authenticated, login, getAccessToken } = usePrivy();

  const [stream, setStream] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const token = authenticated ? await getAccessToken() : undefined;
        const data = await api.streams.get(streamId, token || undefined);
        setStream(data);
      } catch (error) {
        toast.error('Failed to load stream');
      } finally {
        setLoading(false);
      }
    };

    if (streamId) {
      fetchStream();
      const interval = setInterval(fetchStream, 10000);
      return () => clearInterval(interval);
    }
  }, [streamId, authenticated, getAccessToken]);

  const handleClaim = async () => {
    if (!authenticated) {
      login();
      return;
    }

    setClaiming(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');

      const prepareResponse = await api.claim.prepare(streamId, {}, token);

      toast.success('Claim successful!');
      setClaimed(true);

      const updatedStream = await api.streams.get(streamId, token);
      setStream(updatedStream);
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim');
    } finally {
      setClaiming(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = `I'm receiving a StreamGift! Check it out:`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'StreamGift',
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  if (loading || !ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-600">Stream not found</p>
        </div>
      </div>
    );
  }

  const startTime = new Date(stream.startTime);
  const endTime = new Date(stream.endTime);
  const isComplete = stream.status === 'COMPLETED';
  const isCancelled = stream.status === 'CANCELLED';
  const totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  const remainingAmount = BigInt(stream.totalAmount) - BigInt(stream.claimedAmount);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      <Navigation />

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-8 py-6">
            <p className="text-violet-200 text-sm">StreamGift</p>
            <h1 className="text-2xl font-bold text-white mt-1">
              {stream.recipientSocial
                ? `Gift for ${stream.recipientSocial.handle}`
                : 'Your Stream'}
            </h1>
          </div>

          <div className="p-8">
            {/* Success Message */}
            {claimed && (
              <div className="mb-6 flex items-center gap-3 bg-green-50 text-green-700 px-4 py-3 rounded-xl">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Claim successful!</span>
              </div>
            )}

            {/* Status Badges */}
            {isComplete && (
              <div className="mb-6 flex items-center gap-3 bg-blue-50 text-blue-700 px-4 py-3 rounded-xl">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">This stream is complete</span>
              </div>
            )}

            {isCancelled && (
              <div className="mb-6 flex items-center gap-3 bg-gray-50 text-gray-700 px-4 py-3 rounded-xl">
                <span className="font-medium">This stream was cancelled</span>
              </div>
            )}

            {/* Stream Ticker */}
            {!isComplete && !isCancelled && (
              <div className="mb-8">
                <StreamTicker
                  startTime={startTime}
                  endTime={endTime}
                  ratePerSecond={stream.ratePerSecond}
                  claimedAmount={stream.claimedAmount}
                  totalAmount={stream.totalAmount}
                />
              </div>
            )}

            {/* Completed Amount Display */}
            {isComplete && (
              <div className="mb-8 text-center">
                <p className="text-sm text-gray-500 mb-2">Total Received</p>
                <p className="text-5xl font-bold text-violet-600">
                  {formatAmount(stream.totalAmount)}
                  <span className="ml-2 text-2xl text-gray-400">MOVE</span>
                </p>
              </div>
            )}

            {/* Progress Bar */}
            <div className="mb-8">
              <StreamProgress
                startTime={startTime}
                endTime={endTime}
                claimedAmount={stream.claimedAmount}
                totalAmount={stream.totalAmount}
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatAmount(stream.totalAmount)} MOVE
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Duration</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDuration(totalDuration)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Already Claimed</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatAmount(stream.claimedAmount)} MOVE
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">Remaining</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatAmount(remainingAmount.toString())} MOVE
                </p>
              </div>
            </div>

            {/* Stream Details */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-gray-600">
                <User className="h-5 w-5" />
                <span className="text-sm">
                  From: {shortenAddress(stream.sender)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="h-5 w-5" />
                <span className="text-sm">
                  Started {startTime.toLocaleDateString()} at{' '}
                  {startTime.toLocaleTimeString()}
                </span>
              </div>
              {stream.message && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MessageSquare className="h-5 w-5 mt-0.5" />
                  <div className="bg-yellow-50 rounded-lg px-4 py-3 flex-1">
                    <p className="text-sm text-gray-700">{stream.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Claim Button */}
            {!isComplete && !isCancelled && (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {claiming ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Claiming...</span>
                  </>
                ) : authenticated ? (
                  'Claim Now - Free'
                ) : (
                  'Sign In to Claim'
                )}
              </button>
            )}

            {/* Help Text */}
            {!authenticated && !isComplete && (
              <p className="text-center text-sm text-gray-500 mt-4">
                Sign in with your email or social account to claim. No gas fees
                required.
              </p>
            )}

            {/* Share Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </button>
            </div>
          </div>
        </div>

        {/* Transaction Info (for authenticated users) */}
        {authenticated && stream.onChainId > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500 mb-2">On-Chain Details</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Stream ID</span>
              <span className="text-sm font-mono text-gray-900">
                #{stream.onChainId}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-600">Network</span>
              <span className="text-sm text-gray-900">Movement Testnet</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}