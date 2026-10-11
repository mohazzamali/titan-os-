// nexus-hub/dashboard/app/page.tsx
'use client';
import { useState } from 'react';

export default function Home() {
  const [logs, setLogs] = useState<string[]>(['[SYS] NEXUS CLOUD GATEWAY ONLINE.']);
  const [loading, setLoading] = useState(false);

  const deployPayload = async () => {
    setLoading(true);
    setLogs(prev => [...prev, '[NET] INITIATING UDP DATAGRAM INJECTION...']);
    
    try {
      const res = await fetch('/api/deploy', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setLogs(prev => [...prev, `[OK] ${data.message}`]);
        setLogs(prev => [...prev, '[AWAITING BFT SETTLEMENT...]']);
      } else {
        setLogs(prev => [...prev, `[ERROR] ${data.error}`]);
      }
    } catch (err) {
      setLogs(prev => [...prev, '[FATAL] CONNECTION TO GATEWAY LOST.']);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-[#00ffcc] p-8 font-mono flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full border border-[#00ffcc] bg-[#151a22] shadow-[0_0_20px_rgba(0,255,204,0.2)]">
        
        {/* HEADER */}
        <div className="bg-[#00ffcc] text-black font-bold p-3 text-center tracking-widest">
          NEXUS TITAN OS :: DECENTRALIZED WEB3 GATEWAY
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-[#00ffcc]/30 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-gray-400">NETWORK TVL</span>
            <span className="text-2xl text-yellow-400 font-bold mt-1">930 NXC</span>
          </div>
          <div className="flex flex-col items-center border-l border-r border-[#00ffcc]/30">
            <span className="text-gray-400">GLOBAL TRUST</span>
            <span className="text-2xl text-green-400 font-bold mt-1">100%</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400">WASM SANDBOX</span>
            <span className="text-2xl text-purple-400 font-bold mt-1">SECURED</span>
          </div>
        </div>

        {/* LOG TERMINAL */}
        <div className="p-6 h-64 overflow-y-auto bg-black text-[#50fa7b]">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{`> ${log}`}</div>
          ))}
          {loading && <div className="animate-pulse">{`> TRANSMITTING...`}</div>}
        </div>

        {/* ACTION PANEL */}
        <div className="p-6 flex justify-center bg-[#1a212d]">
          <button 
            onClick={deployPayload}
            disabled={loading}
            className="bg-[#00ffcc] text-black px-8 py-3 font-bold tracking-wider hover:bg-white transition-all disabled:opacity-50"
          >
            {loading ? 'INJECTING...' : 'INJECT WASM PAYLOAD OVER-THE-AIR'}
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-gray-500 text-sm">
        SECURE DMA RINGS (128B) ENABLED | ZERO-COPY NETWORK ARCHITECTURE
      </div>
    </div>
  );
}