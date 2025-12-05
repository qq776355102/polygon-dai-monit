import { WalletData, HistoricalRecord } from '../types';
import { POLYGON_RPC } from '../constants';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'polygon_dai_monitor_data';
const LAST_UPDATE_KEY = 'polygon_dai_last_update';
const RPC_KEY = 'polygon_dai_rpc_url';

// Initialize Supabase if keys are present
const supabaseUrl = typeof process !== 'undefined' ? process.env.SUPABASE_URL : '';
const supabaseKey = typeof process !== 'undefined' ? process.env.SUPABASE_KEY : '';
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isCloudStorageEnabled = () => !!supabase;

export const getWallets = async (): Promise<WalletData[]> => {
  if (supabase) {
    try {
      // 1. Fetch Cloud Data
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('key', 'wallets')
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error("Supabase load error:", error);
      }
      
      let cloudWallets: WalletData[] = data?.value || [];

      // 2. Sync Logic: Check LocalStorage for any data that isn't in Cloud
      // This handles the "upload from my computer" -> "sync to everyone" requirement
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        const localWallets: WalletData[] = JSON.parse(localStr);
        if (localWallets.length > 0) {
           const cloudMap = new Map(cloudWallets.map(w => [w.address.toLowerCase(), w]));
           let hasNewData = false;

           localWallets.forEach(localW => {
             // If local address does not exist in cloud, add it
             if (!cloudMap.has(localW.address.toLowerCase())) {
               cloudWallets.push(localW);
               hasNewData = true;
             }
           });

           // 3. If we merged new local data into cloud, save the updated list back to cloud
           if (hasNewData) {
             console.log("Syncing local data to cloud...");
             await saveWallets(cloudWallets); 
             // Optional: Clear local storage to avoid confusion? 
             // For now we keep it as a cache/backup but Cloud is source of truth.
           }
        }
      }

      return cloudWallets;
    } catch (err) {
      console.error("Failed to fetch from cloud, falling back to local:", err);
      // Fallback
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }
  } else {
    // LocalStorage Only Mode
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }
};

export const saveWallets = async (wallets: WalletData[]) => {
  if (supabase) {
    try {
      // We store the entire array in a single JSONB row for simplicity
      const { error } = await supabase
        .from('app_data')
        .upsert({ key: 'wallets', value: wallets });
      
      if (error) console.error("Supabase save error:", error);
    } catch (err) {
      console.error("Failed to save to cloud:", err);
    }
  } 
  
  // Always save to local as well for offline/speed
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
};

export const getLastUpdateTime = async (): Promise<string | null> => {
  if (supabase) {
    try {
      const { data } = await supabase.from('app_data').select('value').eq('key', 'last_update').single();
      return data?.value || null;
    } catch (e) { return localStorage.getItem(LAST_UPDATE_KEY); }
  }
  return localStorage.getItem(LAST_UPDATE_KEY);
};

export const setLastUpdateTime = async (isoDate: string) => {
  if (supabase) {
    await supabase.from('app_data').upsert({ key: 'last_update', value: isoDate });
  }
  localStorage.setItem(LAST_UPDATE_KEY, isoDate);
};

// RPC URL remains local-only preference
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