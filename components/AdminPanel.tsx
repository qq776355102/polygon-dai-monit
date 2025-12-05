import React, { useState, useEffect } from 'react';
import { Upload, Trash2, RefreshCw, Settings, Save } from 'lucide-react';

interface AdminPanelProps {
  onUpload: (data: { address: string; label: string }[]) => void;
  onPurge: () => void;
  isUpdating: boolean;
  triggerUpdate: () => void;
  currentRpc: string;
  onUpdateRpc: (url: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  onUpload, 
  onPurge, 
  isUpdating, 
  triggerUpdate,
  currentRpc,
  onUpdateRpc
}) => {
  const [inputText, setInputText] = useState('');
  const [rpcInput, setRpcInput] = useState(currentRpc);
  const [rpcSaved, setRpcSaved] = useState(false);

  useEffect(() => {
    setRpcInput(currentRpc);
  }, [currentRpc]);

  const handleUpload = () => {
    const lines = inputText.split('\n');
    const parsedData: { address: string; label: string }[] = [];
    const addressRegex = /(0x[a-fA-F0-9]{40})/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(addressRegex);
      if (match) {
        const address = match[0];
        // Remove the address from the line to find the label
        // This handles "Label, Address" or "Address" or "Label Address"
        let label = trimmed.replace(address, '').replace(/[,，]/g, '').trim();
        
        parsedData.push({ address, label });
      }
    }

    if (parsedData.length > 0) {
      onUpload(parsedData);
      setInputText('');
    } else {
      alert("No valid addresses found in input. Please use format: '0xAddress' or 'Label, 0xAddress'");
    }
  };

  const handleRpcSave = () => {
    if (!rpcInput.trim()) {
      alert("RPC URL cannot be empty");
      return;
    }
    onUpdateRpc(rpcInput.trim());
    setRpcSaved(true);
    setTimeout(() => setRpcSaved(false), 2000);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl mb-8 animate-fade-in">
      <h3 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
        <span className="bg-indigo-500 w-2 h-6 rounded mr-3"></span>
        Admin Controls
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Column */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Upload Wallets (One per line)
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Supported formats:<br/>
            1. Pure Address: <code>0x123...</code><br/>
            2. Label & Address: <code>My Fund, 0x123...</code>
          </p>
          <textarea
            className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono"
            placeholder="Whale One, 0x742d35Cc6634C0532925a3b844Bc454e4438f44e&#10;0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="mt-3 flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!inputText}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} className="mr-2" />
              Upload Addresses
            </button>
            <button
               onClick={onPurge}
               className="flex items-center px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
            >
               <Trash2 size={16} className="mr-2" />
               Purge All Data
            </button>
          </div>
        </div>

        {/* System Column */}
        <div className="flex flex-col gap-4">
          
          {/* RPC Config */}
          <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50">
             <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center">
                <Settings size={16} className="mr-2 text-indigo-400" />
                Network Configuration
             </h4>
             <div className="mb-2">
                <label className="block text-xs text-slate-500 mb-1">Polygon RPC Node URL</label>
                <div className="flex gap-2">
                   <input 
                      type="text" 
                      value={rpcInput}
                      onChange={(e) => setRpcInput(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="https://polygon-rpc.com"
                   />
                   <button
                      onClick={handleRpcSave}
                      className="px-3 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-600/50 rounded text-sm font-medium transition-colors flex items-center"
                   >
                      <Save size={16} className={rpcSaved ? 'text-green-400' : ''} />
                   </button>
                </div>
                {rpcSaved && <div className="text-xs text-green-500 mt-1">Saved successfully!</div>}
             </div>
          </div>

          {/* Sync Operations */}
          <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 flex-1">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">System Operations</h4>
            <p className="text-xs text-slate-500 mb-4">
              The system automatically updates at 8:00 AM. You can manually force a balance sync via Multicall3.
            </p>
            
            <div className="flex items-center justify-between bg-slate-800 p-4 rounded border border-slate-700">
              <div>
                 <div className="text-sm font-medium text-slate-200">Force Balance Update</div>
                 <div className="text-xs text-slate-500">Fetches latest DAI balances from Polygon RPC</div>
              </div>
              <button
                onClick={triggerUpdate}
                disabled={isUpdating}
                className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={`mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;