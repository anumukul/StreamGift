import Link from 'next/link';
import { Navigation } from '@/components/layout/Navigation';
import { ArrowRight, Zap, Shield, Gift } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      <Navigation />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Stream Money to{' '}
            <span className="text-violet-600">Anyone</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Send continuous money streams to any Twitter handle or email. 
            Recipients claim accumulated funds anytime, with zero gas fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/send"
              className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-violet-700 transition-colors"
            >
              Start Streaming
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 py-16">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="h-12 w-12 bg-violet-100 rounded-xl flex items-center justify-center mb-6">
              <Gift className="h-6 w-6 text-violet-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Stream to Anyone
            </h3>
            <p className="text-gray-600">
              Send to Twitter handles or email addresses. No wallet required for recipients.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Zero Gas Fees
            </h3>
            <p className="text-gray-600">
              Recipients claim for free. We sponsor all gas fees for a seamless experience.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Real-Time Streaming
            </h3>
            <p className="text-gray-600">
              Watch balances grow every second. Claim anytime, as much as you want.
            </p>
          </div>
        </div>

        <div className="py-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8 mt-12">
            {[
              { step: '1', title: 'Connect', desc: 'Sign in with email or social' },
              { step: '2', title: 'Send', desc: 'Enter recipient and amount' },
              { step: '3', title: 'Stream', desc: 'Money flows every second' },
              { step: '4', title: 'Claim', desc: 'Recipient claims anytime' },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="h-12 w-12 bg-violet-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}