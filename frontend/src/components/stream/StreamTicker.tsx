'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAmount } from '@/lib/utils';

interface Props {
  startTime: Date;
  endTime: Date;
  ratePerSecond: string;
  claimedAmount: string;
  totalAmount: string;
}

export function StreamTicker({
  startTime,
  endTime,
  ratePerSecond,
  claimedAmount,
  totalAmount,
}: Props) {
  const [claimable, setClaimable] = useState('0');
  const [displayValue, setDisplayValue] = useState('0.0000');

  useEffect(() => {
    const calculateClaimable = () => {
      const now = Date.now();
      const start = startTime.getTime();
      const end = endTime.getTime();

      if (now < start) {
        return '0';
      }

      const effectiveTime = Math.min(now, end);
      const elapsed = Math.floor((effectiveTime - start) / 1000);
      const accrued = BigInt(elapsed) * BigInt(ratePerSecond);
      const remaining = BigInt(totalAmount) - BigInt(claimedAmount);
      
      const claimableAmount = accrued > remaining ? remaining : accrued;
      return claimableAmount.toString();
    };

    const updateClaimable = () => {
      const newClaimable = calculateClaimable();
      setClaimable(newClaimable);
      setDisplayValue(formatAmount(newClaimable));
    };

    updateClaimable();
    const interval = setInterval(updateClaimable, 100);

    return () => clearInterval(interval);
  }, [startTime, endTime, ratePerSecond, claimedAmount, totalAmount]);

  const digits = displayValue.split('');

  return (
    <div className="text-center">
      <p className="text-sm text-gray-500 mb-2">Claimable Now</p>
      <div className="flex items-center justify-center gap-0.5 font-mono text-5xl font-bold text-violet-600">
        <AnimatePresence mode="popLayout">
          {digits.map((digit, index) => (
            <motion.span
              key={`${index}-${digit}`}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="inline-block"
            >
              {digit}
            </motion.span>
          ))}
        </AnimatePresence>
        <span className="ml-2 text-2xl text-gray-400">MOVE</span>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        +{formatAmount(ratePerSecond)} MOVE/second
      </p>
    </div>
  );
}