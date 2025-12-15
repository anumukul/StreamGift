import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(amount: string | bigint, decimals: number = 8): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return integerPart.toString();
  }
  
  return `${integerPart}.${trimmedFractional.substring(0, 4)}`;
}

export function parseAmount(amount: string, decimals: number = 8): string {
  const parts = amount.split('.');
  const integerPart = parts[0] || '0';
  let fractionalPart = parts[1] || '';
  
  fractionalPart = fractionalPart.padEnd(decimals, '0').substring(0, decimals);
  
  return (BigInt(integerPart) * BigInt(10 ** decimals) + BigInt(fractionalPart)).toString();
}

export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}

export function formatTimeRemaining(endTime: Date): string {
  const now = new Date();
  const remaining = Math.max(0, endTime.getTime() - now.getTime());
  return formatDuration(Math.floor(remaining / 1000));
}