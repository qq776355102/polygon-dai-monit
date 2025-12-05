import { WalletData, HistoricalRecord } from '../types';
import { POLYGON_RPC } from '../constants';

const STORAGE_KEY = 'polygon_dai_monitor_data';
const LAST_UPDATE_KEY = 'polygon_dai_last_update';
const RPC_KEY = 'polygon_dai_rpc_url';

// Mock owner names generation for demo purposes
const generateOwnerName = (idx: number) => `Whale Investor #${idx + 1}`;

export const loadWallets = (): WalletData[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveWallets = (wallets: WalletData[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
};

export const getLastUpdateTime = (): string | null => {
  return localStorage.getItem(LAST_UPDATE_KEY);
};

export const setLastUpdateTime = (isoDate: string) => {
  localStorage.setItem(LAST_UPDATE_KEY, isoDate);
};

export const getRpcUrl = (): string => {
  return localStorage.getItem(RPC_KEY) || POLYGON_RPC;
};

export const saveRpcUrl = (url: string) => {
  localStorage.setItem(RPC_KEY, url);
};

export const formatAddress = (addr: string) => {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

/**
 * Updates wallet history logic:
 * 1. Keeps only last 7 days.
 * 2. Compares dates to prevent duplicate daily entries if run multiple times same day.
 */
export const updateWalletHistory = (
  wallet: WalletData, 
  newBalance: number, 
  currentDate: string
): WalletData => {
  const newHistory: HistoricalRecord[] = [...wallet.history];
  
  // Check if we already have an entry for today (simple date check YYYY-MM-DD)
  const todayStr = currentDate.split('T')[0];
  const lastEntry = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;

  if (lastEntry && lastEntry.date.startsWith(todayStr)) {
    // Update today's entry
    newHistory[newHistory.length - 1] = { date: currentDate, balance: newBalance };
  } else {
    // Add new entry
    newHistory.push({ date: currentDate, balance: newBalance });
  }

  // Keep max 7 items (Latest week) + we always have initialBalance separate
  if (newHistory.length > 7) {
    newHistory.shift(); // Remove oldest
  }

  return {
    ...wallet,
    currentBalance: newBalance,
    lastUpdated: currentDate,
    history: newHistory
  };
};