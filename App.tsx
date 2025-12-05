import React, { useState, useEffect, useMemo } from 'react';
import { WalletData, SortOption } from './types';
import { loadWallets, saveWallets, getLastUpdateTime, setLastUpdateTime, updateWalletHistory, getRpcUrl, saveRpcUrl } from './services/storageService';
import { fetchBalancesBatch, fetchBlockNumber, reinitializeClient } from './services/web3Service';
import { analyzeWallets } from './services/geminiService';
import WalletTable from './components/WalletTable';
import AdminPanel from './components/AdminPanel';
import StatsCard from './components/StatsCard';
import { LayoutDashboard, Users, TrendingUp, Search, Filter, RefreshCcw, Sparkles } from 'lucide-react';
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

  // Initialize Data & Admin State
  useEffect(() => {
    // Load persisted data
    const loaded = loadWallets();
    setWallets(loaded);
    setLastUpdate(getLastUpdateTime());

    // Check Admin access via URL
    const checkAdminStatus = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('/admin') || hash.includes('/admin')) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
    // Re-check on nav changes (mainly for hash routing)
    window.addEventListener('popstate', checkAdminStatus);
    window.addEventListener('hashchange', checkAdminStatus);

    // Auto-update logic (Simulating 8 AM check)
    const last = getLastUpdateTime();
    if (last) {
      const lastDate = new Date(last);
      const now = new Date();
      const hoursDiff = Math.abs(now.getTime() - lastDate.getTime()) / 36e5;
      if (hoursDiff > 24) {
        handleSyncBalances();
      }
    }

    return () => {
      window.removeEventListener('popstate', checkAdminStatus);
      window.removeEventListener('hashchange', checkAdminStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Web3 Sync Logic
  const handleSyncBalances = async () => {
    if (wallets.length === 0) return;
    setIsLoading(true);
    try {
      const addresses = wallets.map(w => w.address);
      const balancesMap = await fetchBalancesBatch(addresses);
      const nowISO = new Date().toISOString();

      const updatedWallets = wallets.map(w => {
        const newBal = balancesMap.get(w.address) ?? w.currentBalance;
        return updateWalletHistory(w, newBal, nowISO);
      });

      setWallets(updatedWallets);
      saveWallets(updatedWallets);
      setLastUpdate(nowISO);
      setLastUpdateTime(nowISO);
    } catch (err) {
      console.error("Sync failed", err);
      alert("Failed to sync balances. Check console.");
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

      const merged = [...wallets, ...newWallets];
      // Dedup by address: use the new entry if it exists (allows updating labels by re-uploading)
      const uniqueMap = new Map();
      wallets.forEach(w => uniqueMap.set(w.address, w));
      newWallets.forEach(w => uniqueMap.set(w.address, w));
      
      const unique = Array.from(uniqueMap.values());
      
      setWallets(unique);
      saveWallets(unique);
      setLastUpdate(nowISO);
      setLastUpdateTime(nowISO);
    } catch (err) {
      alert("Error initializing new addresses");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWallet = (addr: string) => {
    if (!window.confirm("Delete this wallet?")) return;
    const filtered = wallets.filter(w => w.address !== addr);
    setWallets(filtered);
    saveWallets(filtered);
  };

  const handlePurge = () => {
    if (window.confirm("Are you sure you want to delete ALL data?")) {
      setWallets([]);
      saveWallets([]);
      setLastUpdate(null);
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

      switch (sortOption) {
        case 'balance_desc': return b.currentBalance - a.currentBalance;
        case 'balance_asc': return a.currentBalance - b.currentBalance;
        case 'change7d_desc': return getChange7d(b) - getChange7d(a);
        case 'change7d_asc': return getChange7d(a) - getChange7d(b);
        case 'change1d_desc': return getChange1d(b) - getChange1d(a);
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
              <p className="text-xs text-slate-400 flex items-center">
                <RefreshCcw size={10} className="mr-1" />
                Updated: {lastUpdate ? new Date(lastUpdate).toLocaleString() : 'Never'}
              </p>
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
            triggerUpdate={handleSyncBalances}
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
                </select>
             </div>
             
             {/* Gemini Button */}
             <button
               onClick={handleAnalysis}
               disabled={isAnalyzing || wallets.length === 0}
               className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
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
            System auto-updates daily. Access Admin features via <code>/admin</code> URL.
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;