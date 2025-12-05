export interface HistoricalRecord {
  date: string; // ISO String YYYY-MM-DD
  balance: number;
}

export interface WalletData {
  address: string;
  owner: string; // Optional name/label
  initialBalance: number;
  initialBlock: number;
  currentBalance: number;
  lastUpdated: string; // ISO Timestamp
  history: HistoricalRecord[]; // Last 7 days
}

export type SortOption = 'balance_desc' | 'balance_asc' | 'change7d_desc' | 'change7d_asc' | 'change1d_desc';

export interface AppState {
  wallets: WalletData[];
  lastGlobalUpdate: string | null;
  isAdmin: boolean;
}