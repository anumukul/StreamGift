'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Wallet, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn, shortenAddress } from '@/lib/utils';

export function Navigation() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const walletAddress = user?.wallet?.address;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-gray-900">StreamGift</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/send"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Send
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Dashboard
            </Link>

            {ready && (
              <>
                {authenticated ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                      <Wallet className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {walletAddress ? shortenAddress(walletAddress) : 'No wallet'}
                      </span>
                    </div>
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm font-medium">Sign out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={login}
                    className="bg-violet-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-violet-700 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-4">
            <Link
              href="/send"
              className="text-gray-600 hover:text-gray-900 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Send
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            {ready && authenticated && (
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="text-left text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}