import React from 'react';
import { WalletData } from '../types';
import { formatAddress } from '../services/storageService';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface WalletTableProps {
  wallets: WalletData[];
  isAdmin: boolean;
  onDelete: (address: string) => void;
}

const WalletTable: React.FC<WalletTableProps> = ({ wallets, isAdmin, onDelete }) => {
  
  const getChangeIndicator = (current: number, previous: number) => {
    const diff = current - previous;
    const percent = previous > 0 ? (diff / previous) * 100 : 0;
    
    if (Math.abs(diff) < 0.01) return <div className="text-gray-500 flex items-center"><Minus size={14} className="mr-1"/> 0.00%</div>;
    
    const isPositive = diff > 0;
    return (
      <div className={clsx("flex items-center font-medium", isPositive ? "text-green-400" : "text-red-400")}>
        {isPositive ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
        {Math.abs(diff).toFixed(2)} ({Math.abs(percent).toFixed(1)}%)
      </div>
    );
  };

  return (
    <div className="overflow-x-auto bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
            <th className="p-4 font-semibold">Address / Owner</th>
            <th className="p-4 font-semibold text-right">Current Balance (DAI)</th>
            <th className="p-4 font-semibold text-right">24h Change</th>
            <th className="p-4 font-semibold text-right">7d Change</th>
            <th className="p-4 font-semibold hidden md:table-cell">Last Updated</th>
            {isAdmin && <th className="p-4 font-semibold text-center">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {wallets.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-500">
                No wallets found. Use Admin mode to upload addresses.
              </td>
            </tr>
          ) : (
            wallets.map((wallet) => {
              const prevDayBalance = wallet.history.length > 1 
                ? wallet.history[wallet.history.length - 2].balance 
                : wallet.initialBalance;
              
              const prevWeekBalance = wallet.history.length > 0
                ? wallet.history[0].balance
                : wallet.initialBalance;

              return (
                <tr key={wallet.address} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{wallet.owner || 'Unknown'}</div>
                    <div className="text-xs text-slate-500 font-mono mt-1">{formatAddress(wallet.address)}</div>
                  </td>
                  <td className="p-4 text-right font-mono text-slate-200">
                    {wallet.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right text-sm">
                    {getChangeIndicator(wallet.currentBalance, prevDayBalance)}
                  </td>
                  <td className="p-4 text-right text-sm">
                    {getChangeIndicator(wallet.currentBalance, prevWeekBalance)}
                  </td>
                  <td className="p-4 text-xs text-slate-500 hidden md:table-cell">
                    {new Date(wallet.lastUpdated).toLocaleString()}
                  </td>
                  {isAdmin && (
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => onDelete(wallet.address)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded transition-colors text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default WalletTable;
