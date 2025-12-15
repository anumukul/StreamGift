'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  startTime: Date;
  endTime: Date;
  claimedAmount: string;
  totalAmount: string;
}

export function StreamProgress({
  startTime,
  endTime,
  claimedAmount,
  totalAmount,
}: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculateProgress = () => {
      const now = Date.now();
      const start = startTime.getTime();
      const end = endTime.getTime();
      const total = end - start;
      const elapsed = now - start;
      
      return Math.min(100, Math.max(0, (elapsed / total) * 100));
    };

    const updateProgress = () => {
      setProgress(calculateProgress());
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime]);

  const claimedPercent = (BigInt(claimedAmount) * BigInt(100)) / BigInt(totalAmount);

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>{progress.toFixed(1)}% streamed</span>
        <span>{claimedPercent.toString()}% claimed</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full relative"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        >
          {Number(claimedPercent) > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-green-500 rounded-l-full"
              style={{ width: `${(Number(claimedPercent) / progress) * 100}%` }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}