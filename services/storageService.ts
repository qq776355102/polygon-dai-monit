import { WalletData, HistoricalRecord } from '../types';
import { POLYGON_RPC } from '../constants';
import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'polygon_dai_monitor_data';
const LAST_UPDATE_KEY = 'polygon_dai_last_update';
const RPC_KEY = 'polygon_dai_rpc_url';

// Initialize Supabase with robust checks
const supabaseUrl = typeof process !== 'undefined' ? process.env.SUPABASE_URL : '';
const supabaseKey = typeof process !== 'undefined' ? process.env.SUPABASE_KEY : '';

// Ensure we don't crash if keys are somehow missing, though vite.config.ts provides defaults
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isCloudStorageEnabled = () => !!supabase;

export const getWallets = async (): Promise<WalletData[]> => {
  if (supabase) {
    try {
      console.log("Attempting to fetch data from Cloud (Supabase)...");
      
      // 1. Fetch Cloud Data
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('key', 'wallets')
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.warn("Supabase load warning (might be first run):", error.message);
      }
      
      let cloudWallets: WalletData[] = data?.value || [];
      console.log(`Cloud returned ${cloudWallets.length} wallets.`);

      // 2. Sync Logic: Local -> Cloud
      // This is crucial for the "upload from my computer" -> "sync to everyone" workflow.
      // We check if LocalStorage has data. If so, we merge it into Cloud if it's missing there.
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        const localWallets: WalletData[] = JSON.parse(localStr);
        
        if (localWallets.length > 0) {
           // Create a map of existing cloud addresses for fast lookup (case insensitive)
           const cloudMap = new Map(cloudWallets.map(w => [w.address.toLowerCase(), w]));
           let hasNewData = false;

           localWallets.forEach(localW => {
             // If local address does not exist in cloud, add it
             if (!cloudMap.has(localW.address.toLowerCase())) {
               console.log(`Syncing local wallet to cloud: ${localW.owner} (${localW.address})`);
               cloudWallets.push(localW);
               hasNewData = true;
             }
           });

           // 3. If we merged new local data into cloud, save the updated list back to cloud
           if (hasNewData) {
             console.log("New local data detected. Saving merged list to cloud...");
             await saveWallets(cloudWallets); 
           } else {
             console.log("Local data is already in sync with cloud.");
           }
        }
      }

      // Update local cache to match the authoritative cloud state
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudWallets));

      return cloudWallets;
    } catch (err) {
      console.error("Failed to fetch from cloud, falling back to local:", err);
      // Fallback to local storage if internet is down or supabase is misconfigured
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }
  } else {
    // LocalStorage Only Mode
    console.log("Cloud storage disabled. Using local storage.");
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }
};

export const saveWallets = async (wallets: WalletData[]) => {
  // Always save to local first for immediate UI feedback and offline capability
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));

  if (supabase) {
    try {
      // We store the entire array in a single JSONB row. 
      // This is simple and effective for < 1000 wallets.
      const { error } = await supabase
        .from('app_data')
        .upsert({ key: 'wallets', value: wallets });
      
      if (error) {
        console.error("Supabase save error:", error);
      } else {
        console.log("Data successfully saved to Supabase.");
      }
    } catch (err) {
      console.error("Failed to save to cloud:", err);
    }
  } 
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
  localStorage.setItem(LAST_UPDATE_KEY, isoDate);
  if (supabase) {
    await supabase.from('app_data').upsert({ key: 'last_update', value: isoDate });
  }
};

// RPC URL remains local-only preference because different users might want different nodes
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