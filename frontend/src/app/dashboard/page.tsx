'use client';

import { useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import Link from 'next/link';
import { Navigation } from '@/components/layout/Navigation';
import { api } from '@/lib/api';
import { formatAmount, shortenAddress, formatTimeRemaining } from '@/lib/utils';
import { Loader2, ArrowUpRight, ArrowDownLeft, Clock, ExternalLink } from 'lucide-react';

interface Stream {
  id: string;
  senderAddress: string;
  recipientAddress: string;
  recipientSocialHandle: string | null;
  totalAmount: string;
  claimedAmount: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function DashboardPage() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();

  const [outgoingStreams, setOutgoingStreams] = useState<Stream[]>([]);
  const [incomingStreams, setIncomingStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');

  const walletAddress = wallets?.[0]?.address;
  const userEmail = user?.email?.address;

  useEffect(() => {
    const fetchStreams = async () => {
      if (!authenticated || !walletAddress) {
        setLoading(false);
        return;
      }

      try {
        const token = await getAccessToken();
        if (!token) return;

        const [outgoing, incoming] = await Promise.all([
          api.streams.getOutgoing(token, walletAddress),
          api.streams.getIncoming(token, walletAddress, userEmail),
        ]);

        setOutgoingStreams(outgoing.streams || []);
        setIncomingStreams(incoming.streams || []);
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      } finally {
        setLoading(false);
      }
    };

    if (ready && walletAddress) {
      fetchStreams();
    }
  }, [ready, authenticated, getAccessToken, walletAddress, userEmail]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Sign in to view your streams
          </h2>
          <button
            onClick={login}
            className="bg-violet-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-violet-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const streams = activeTab === 'outgoing' ? outgoingStreams : incomingStreams;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Link
            href="/send"
            className="bg-violet-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-violet-700 transition-colors"
          >
            New Stream
          </Link>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'outgoing'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Sent ({outgoingStreams.length})
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'incoming'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Received ({incomingStreams.length})
          </button>
        </div>

        {streams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600">
              {activeTab === 'outgoing'
                ? "You haven't sent any streams yet."
                : "You haven't received any streams yet."}
            </p>
            {activeTab === 'outgoing' && (
              <Link
                href="/send"
                className="inline-block mt-4 text-violet-600 font-medium hover:underline"
              >
                Create your first stream
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {streams.map((stream) => {
              const endTime = new Date(stream.endTime);
              const totalAmount = BigInt(stream.totalAmount || '0');
              const claimedAmount = BigInt(stream.claimedAmount || '0');
              const progress = totalAmount > 0n 
                ? Number((claimedAmount * 100n) / totalAmount)
                : 0;
              const isComplete = stream.status === 'COMPLETED';

              return (
                <Link
                  key={stream.id}
                  href={`/claim/${stream.id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-violet-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        {activeTab === 'outgoing' ? 'To' : 'From'}
                      </p>
                      <p className="font-medium text-gray-900">
                        {stream.recipientSocialHandle ||
                          shortenAddress(
                            activeTab === 'outgoing'
                              ? stream.recipientAddress
                              : stream.senderAddress
                          )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className="font-semibold text-gray-900">
                        {formatAmount(stream.totalAmount)} MOVE
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {isComplete ? (
                        <span className="text-green-600">Completed</span>
                      ) : (
                        <span>{formatTimeRemaining(endTime)} remaining</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-600 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">
                        {progress}%
                      </span>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}