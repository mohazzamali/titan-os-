'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([
    "> [SYS] NEXUS GATEWAY INITIALIZED.",
    "> [NET] SCANNING UDP PORTS 6969, 6970, 6971 FOR LIVE MINERS..."
  ]);
  const [status, setStatus] = useState("SCANNING SWARM");
  const [clientWallet, setClientWallet] = useState(0);
  const [tvl, setTvl] = useState(0);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [isComputing, setIsComputing] = useState(false);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setClientWallet(data?.clientWallet ?? 0);
      setTvl(data?.networkTvl ?? 0);
      setActiveNodes(data?.activeNodes ?? 0);
      setLivePorts(data?.livePorts ?? []);
      if (!isComputing) {
        setStatus((data?.activeNodes ?? 0) > 0 ? "SWARM ONLINE" : "NO MINERS ONLINE");
      }
    } catch (e) {
      console.error("Failed to sync state");
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [isComputing]);

  const injectPayload = async () => {
    setLogs(prev => [...prev, "> [UDP] DISPATCHING WASM BINARY TO LIVE MINER NODES..."]);
    setIsComputing(true);
    setStatus("AWAITING MINER ACK");
    
    try {
      const res = await fetch('/api/deploy', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        const nodeDetails = (data.nodeResponses || [])
          .map((n: any) => `Node :${n.nodePort} => ${n.results?.[0]?.fn}()=${n.results?.[0]?.output} (${n.computeTimeMs}ms)`)
          .join(' | ');

        setLogs(prev => [
          ...prev,
          `> [OK] SHARDS PROCESSED BY ${data.liveNodesUsed.length} LIVE NODE(S) [${data.liveNodesUsed.join(', ')}]`,
          `> [OUT] ${nodeDetails}`,
          `> [PROOF] SWARM RECEIPT: ${data.hashResult.substring(0, 20)}...`,
          `> [ECON] INVOICE PAID: -${(data.cost || 0).toLocaleString()} NXC`
        ]);
        
        await fetchState(); 
        setStatus("TASK VERIFIED");
      } else {
        setStatus("DEPLOYMENT HALTED");
        setLogs(prev => [...prev, `> [ERR] ${data.error || data.message}`]);
      }
    } catch (err: any) {
      setStatus("NETWORK ERROR");
      setLogs(prev => [...prev, `> [ERR] GATEWAY OFFLINE: ${err.message}`]);
    }
    setIsComputing(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-green-500 font-mono p-4 md:p-10 flex flex-col items-center">
      <div className="max-w-5xl w-full border border-green-500/20 bg-black/80 rounded-lg overflow-hidden shadow-2xl shadow-green-500/10">
        
        <div className="bg-gradient-to-r from-gray-900 to-black border-b border-green-500/30 text-white font-bold text-center py-4 text-2xl tracking-[0.2em]">
          NEXUS COMPUTATION GATEWAY (REAL UDP SWARM)
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 border-b border-green-500/20 text-center divide-y md:divide-y-0 md:divide-x divide-green-500/20 bg-[#0a0a0a]">
          <div className="p-6 bg-red-900/10">
            <p className="text-gray-500 text-xs tracking-widest mb-1">YOUR CLIENT WALLET</p>
            <p className="text-red-400 text-3xl font-bold">{(clientWallet ?? 0).toLocaleString()} <span className="text-sm">NXC</span></p>
            <p className="text-gray-600 text-[10px] mt-2 uppercase">Deducted only on Miner ACK</p>
          </div>
          <div className="p-6 bg-[#070707]">
            <p className="text-gray-500 text-xs tracking-widest mb-1">LIVE UDP MINER NODES</p>
            <p className={`text-3xl font-bold ${activeNodes > 0 ? 'text-green-400' : 'text-red-500'}`}>{activeNodes}</p>
            <p className="text-gray-500 text-[10px] mt-2 uppercase">
              {livePorts.length > 0 ? `PORTS: ${livePorts.join(', ')}` : 'ALL PORTS OFFLINE (6969-6971)'}
            </p>
          </div>
          <div className="p-6 bg-green-900/10">
            <p className="text-gray-500 text-xs tracking-widest mb-1">MINER POOL (NETWORK TVL)</p>
            <p className="text-yellow-400 text-3xl font-bold">{(tvl ?? 0).toLocaleString()} <span className="text-sm">NXC</span></p>
            <p className="text-gray-600 text-[10px] mt-2 uppercase">Verified compute rewards</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row h-80">
          <div className="w-full md:w-2/3 p-6 bg-[#020202] overflow-y-auto text-xs md:text-sm leading-relaxed">
            {logs.map((log, i) => (
              <p key={i} className={`mb-1.5 ${
                log.includes('[ERR]') ? 'text-red-500 font-bold' : 
                log.includes('[OUT]') ? 'text-cyan-400 font-bold' :
                log.includes('[ECON]') ? 'text-red-400' : 'text-green-500/80'
              }`}>
                {log}
              </p>
            ))}
          </div>
          <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-green-500/20 flex flex-col justify-center items-center bg-[#070707] p-6">
             <div className="mb-4 text-center">
                <p className="text-gray-500 text-xs tracking-widest mb-2">SWARM STATUS</p>
                <div className={`px-4 py-2 rounded-full border ${
                  activeNodes === 0 ? 'border-red-500 text-red-500' :
                  isComputing ? 'border-cyan-500 text-cyan-400 animate-pulse' : 'border-green-500 text-green-500'
                } text-sm font-bold tracking-wider`}>
                    {status}
                </div>
             </div>
          </div>
        </div>

        <div className="p-6 bg-[#0a0a0a] border-t border-green-500/20 flex justify-center items-center">
          <button 
            onClick={injectPayload}
            disabled={isComputing}
            className={`font-bold py-4 px-12 border-2 transition-all uppercase tracking-widest ${
              isComputing 
              ? 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed' 
              : 'bg-green-600/10 hover:bg-green-600 border-green-600 text-green-500 hover:text-white shadow-[0_0_15px_rgba(0,255,128,0.2)]'
            }`}
          >
            {isComputing ? 'WAITING FOR UDP MINERS...' : '⚡ DISPATCH WASM TO SWARM'}
          </button>
        </div>
      </div>
    </div>
  );
}
