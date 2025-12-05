import React, { useState, useEffect, useMemo } from 'react';
import { WalletData, SortOption } from './types';
import { getWallets, saveWallets, getLastUpdateTime, setLastUpdateTime, updateWalletHistory, getRpcUrl, saveRpcUrl, isCloudStorageEnabled } from './services/storageService';
import { fetchBalancesBatch, fetchBlockNumber, reinitializeClient } from './services/web3Service';
import { analyzeWallets } from './services/geminiService';
import WalletTable from './components/WalletTable';
import AdminPanel from './components/AdminPanel';
import StatsCard from './components/StatsCard';
import { LayoutDashboard, Users, TrendingUp, Search, Filter, RefreshCcw, Sparkles, Cloud, HardDrive } from 'lucide-react';
import clsx from 'clsx';
import { BarChart, Bar, Tooltip, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('balance_desc');
  const [geminiAnalysis, setGeminiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rpcUrl, setRpcUrl] = useState(getRpcUrl());
  const [isCloud, setIsCloud] = useState(false);

  // Check for API Key availability (injected by Vite)
  const hasApiKey = React.useMemo(() => {
    return typeof process !== 'undefined' && !!process.env.API_KEY;
  }, []);

  // Initialize Data & Admin State
  useEffect(() => {
    const initData = async () => {
      setIsCloud(isCloudStorageEnabled());
      
      // Load persisted data (Async)
      // This will now trigger the merge of Local -> Cloud if keys are configured
      const loaded = await getWallets();
      setWallets(loaded);
      
      const last = await getLastUpdateTime();
      setLastUpdate(last);

      // Auto-update logic (Simulating 8 AM check)
      if (last) {
        const lastDate = new Date(last);
        const now = new Date();
        const hoursDiff = Math.abs(now.getTime() - lastDate.getTime()) / 36e5;
        if (hoursDiff > 24) {
          handleSyncBalances(loaded); // Pass current loaded wallets to avoid stale state
        }
      }
    };

    initData();

    // Check Admin access via URL
    const checkAdminStatus = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      if (path.includes('/admin') || hash.includes('admin') || search.includes('admin')) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
    // Re-check on nav changes (mainly for hash routing)
    window.addEventListener('popstate', checkAdminStatus);
    window.addEventListener('hashchange', checkAdminStatus);

    return () => {
      window.removeEventListener('popstate', checkAdminStatus);
      window.removeEventListener('hashchange', checkAdminStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Web3 Sync Logic
  const handleSyncBalances = async (currentWallets = wallets) => {
    if (currentWallets.length === 0) return;
    setIsLoading(true);
    try {
      const addresses = currentWallets.map(w => w.address);
      const balancesMap = await fetchBalancesBatch(addresses);
      const nowISO = new Date().toISOString();

      const updatedWallets = currentWallets.map(w => {
        const newBal = balancesMap.get(w.address) ?? w.currentBalance;
        return updateWalletHistory(w, newBal, nowISO);
      });

      setWallets(updatedWallets);
      await saveWallets(updatedWallets);
      setLastUpdate(nowISO);
      await setLastUpdateTime(nowISO);
    } catch (err) {
      console.error("Sync failed", err);
      alert("Failed to sync balances. Check console and RPC settings in Admin.");
    } finally {
      setIsLoading(false);
    }
  };

  // Admin Actions
  const handleUploadAddresses = async (newEntries: { address: string; label: string }[]) => {
    setIsLoading(true);
    try {
      const currentBlock = await fetchBlockNumber();
      const addresses = newEntries.map(e => e.address);
      const balancesMap = await fetchBalancesBatch(addresses);
      const nowISO = new Date().toISOString();

      const newWallets: WalletData[] = newEntries.map((entry, idx) => {
        const bal = balancesMap.get(entry.address) || 0;
        // Generate default label if missing
        const label = entry.label || `Wallet #${wallets.length + idx + 1}`;
        
        return {
          address: entry.address,
          owner: label,
          initialBalance: bal,
          initialBlock: currentBlock,
          currentBalance: bal,
          lastUpdated: nowISO,
          history: [{ date: nowISO, balance: bal }]
        };
      });

      // Dedup by address: use the new entry if it exists (allows updating labels by re-uploading)
      const uniqueMap = new Map();
      wallets.forEach(w => uniqueMap.set(w.address, w));
      newWallets.forEach(w => uniqueMap.set(w.address, w));
      
      const unique = Array.from(uniqueMap.values());
      
      setWallets(unique);
      await saveWallets(unique);
      setLastUpdate(nowISO);
      await setLastUpdateTime(nowISO);
    } catch (err) {
      alert("Error initializing new addresses. Please check your RPC connection.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWallet = async (addr: string) => {
    if (!window.confirm("Delete this wallet?")) return;
    const filtered = wallets.filter(w => w.address !== addr);
    setWallets(filtered);
    await saveWallets(filtered);
  };

  const handlePurge = async () => {
    if (window.confirm("Are you sure you want to delete ALL data?")) {
      setWallets([]);
      await saveWallets([]);
      setLastUpdate(null);
      await setLastUpdateTime('');
    }
  };

  const handleRpcUpdate = (newUrl: string) => {
    saveRpcUrl(newUrl);
    setRpcUrl(newUrl);
    reinitializeClient();
  };

  const handleAnalysis = async () => {
    if (wallets.length === 0) return;
    setIsAnalyzing(true);
    const result = await analyzeWallets(wallets);
    setGeminiAnalysis(result);
    setIsAnalyzing(false);
  };

  // Derived Data & Filtering
  const filteredWallets = useMemo(() => {
    let result = wallets.filter(w => 
      w.address.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.owner.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      const getChange7d = (w: WalletData) => w.currentBalance - (w.history[0]?.balance || w.initialBalance);
      const getChange1d = (w: WalletData) => {
        if (w.history.length < 2) return 0;
        return w.currentBalance - w.history[w.history.length - 2].balance;
      };

      const ownerA = a.owner || '';
      const ownerB = b.owner || '';

      switch (sortOption) {
        case 'balance_desc': return b.currentBalance - a.currentBalance;
        case 'balance_asc': return a.currentBalance - b.currentBalance;
        case 'change7d_desc': return getChange7d(b) - getChange7d(a);
        case 'change7d_asc': return getChange7d(a) - getChange7d(b);
        case 'change1d_desc': return getChange1d(b) - getChange1d(a);
        case 'owner_asc': return ownerA.localeCompare(ownerB, undefined, { numeric: true, sensitivity: 'base' });
        case 'owner_desc': return ownerB.localeCompare(ownerA, undefined, { numeric: true, sensitivity: 'base' });
        default: return 0;
      }
    });

    return result;
  }, [wallets, searchTerm, sortOption]);

  // Dashboard Stats
  const totalBalance = wallets.reduce((acc, w) => acc + w.currentBalance, 0);
  const totalChange7d = wallets.reduce((acc, w) => acc + (w.currentBalance - (w.history[0]?.balance || w.initialBalance)), 0);
  
  // Chart Data Preparation
  const chartDataMap = new Map<string, number>();
  wallets.forEach(w => {
    w.history.forEach(h => {
      const dateKey = h.date.split('T')[0];
      const curr = chartDataMap.get(dateKey) || 0;
      chartDataMap.set(dateKey, curr + h.balance);
    });
  });
  const chartData = Array.from(chartDataMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Polygon DAI Monitor</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center">
                   <RefreshCcw size={10} className="mr-1" />
                   {lastUpdate ? new Date(lastUpdate).toLocaleString() : 'Never'}
                </span>
                <span className="text-slate-600">|</span>
                <span className={clsx("flex items-center font-medium", isCloud ? "text-green-400" : "text-amber-400")}>
                   {isCloud ? <Cloud size={10} className="mr-1" /> : <HardDrive size={10} className="mr-1" />}
                   {isCloud ? "Cloud Sync Active" : "Local Storage Only"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {isAdmin && <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded font-mono uppercase tracking-wider">Admin Mode</span>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard 
            title="Total DAI Tracked" 
            value={totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            subValue={`${wallets.length} Addresses`}
            icon={Users}
            trend="neutral"
          />
          <StatsCard 
            title="7-Day Net Change" 
            value={(totalChange7d > 0 ? "+" : "") + totalChange7d.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            subValue="Since oldest record in window"
            icon={TrendingUp}
            trend={totalChange7d >= 0 ? 'up' : 'down'}
          />
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-center">
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }}
                    itemStyle={{ color: '#818cf8' }}
                    cursor={{fill: '#334155'}}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-xs text-slate-500 mt-2">Aggregate Balance (Last 7 Days)</div>
          </div>
        </div>

        {/* Admin Zone - Only visible if /admin in URL */}
        {isAdmin && (
          <AdminPanel 
            onUpload={handleUploadAddresses} 
            onPurge={handlePurge}
            isUpdating={isLoading}
            triggerUpdate={() => handleSyncBalances(wallets)}
            currentRpc={rpcUrl}
            onUpdateRpc={handleRpcUpdate}
          />
        )}

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-500" />
            </div>
            <input
              type="text"
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 placeholder-slate-500"
              placeholder="Filter by address or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter size={16} className="text-slate-500" />
                </div>
                <select
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-8 p-2.5 appearance-none"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                >
                  <option value="balance_desc">Highest Balance</option>
                  <option value="balance_asc">Lowest Balance</option>
                  <option value="change7d_desc">Biggest Gainers (7d)</option>
                  <option value="change7d_asc">Biggest Losers (7d)</option>
                  <option value="change1d_desc">Biggest Gainers (24h)</option>
                  <option value="owner_asc">Name (A-Z)</option>
                  <option value="owner_desc">Name (Z-A)</option>
                </select>
             </div>
             
             {/* Gemini Button - Always shown but visual feedback on disabled state if needed */}
             <button
               onClick={handleAnalysis}
               disabled={isAnalyzing || wallets.length === 0}
               className={clsx(
                 "flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg",
                 hasApiKey 
                   ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-indigo-500/20"
                   : "bg-slate-700 text-slate-400 hover:bg-slate-600"
               )}
               title={hasApiKey ? "Generate AI Report" : "API Key Not Configured"}
             >
               <Sparkles size={16} className={clsx("mr-2", isAnalyzing && "animate-spin")} />
               {isAnalyzing ? 'Thinking...' : 'AI Insights'}
             </button>
          </div>
        </div>

        {/* Gemini Analysis Output */}
        {geminiAnalysis && (
          <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-6 mb-8 animate-fade-in">
            <h3 className="text-blue-400 font-semibold mb-2 flex items-center">
              <Sparkles size={16} className="mr-2" /> Gemini Analysis
            </h3>
            <div className="prose prose-invert prose-sm max-w-none text-slate-300">
               <pre className="whitespace-pre-wrap font-sans">{geminiAnalysis}</pre>
            </div>
            <button 
              onClick={() => setGeminiAnalysis(null)}
              className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Close Analysis
            </button>
          </div>
        )}

        {/* Main Table */}
        <WalletTable 
          wallets={filteredWallets} 
          isAdmin={isAdmin} 
          onDelete={handleDeleteWallet} 
        />
        
        {/* Footer info for Demo */}
        <div className="mt-8 text-center text-xs text-slate-600">
          <p>
            System auto-updates daily. 
            {wallets.length === 0 && !isAdmin && (
              <span className="block mt-2 text-indigo-400">
                Hint: Add <code>/admin</code> to your browser URL to enter Admin Mode and upload addresses.
              </span>
            )}
            {!isCloud && (
              <span className="block mt-2 text-amber-500/80">
                Note: Running in Local Mode. Data is not shared with other users. Configure Supabase in .env to enable cloud sync.
              </span>
            )}
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;