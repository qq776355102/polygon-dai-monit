import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, subValue, icon: Icon, trend }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">{title}</h3>
        <div className={clsx("p-2 rounded-lg", 
          trend === 'up' ? "bg-green-500/10 text-green-400" : 
          trend === 'down' ? "bg-red-500/10 text-red-400" : "bg-indigo-500/10 text-indigo-400"
        )}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {subValue && <div className="text-sm text-slate-500">{subValue}</div>}
    </div>
  );
};

export default StatsCard;
