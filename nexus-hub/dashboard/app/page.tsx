'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([
    "> [SYS] NEXUS BFT VERIFICATION ENGINE ARMED.",
    "> [SEC] O(1) DETERMINISTIC SPOT-CHECK ACTIVE (ZERO COMPUTE WASTE)."
  ]);
  const [status, setStatus] = useState("SCANNING SWARM");
  const [clientWallet, setClientWallet] = useState(0);
  const [tvl, setTvl] = useState(0);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [miners, setMiners] = useState<Record<string, any>>({});
  const [customParam, setCustomParam] = useState<string>("42");
  const [uploadedWasm, setUploadedWasm] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setClientWallet(data?.clientWallet ?? 0);
      setTvl(data?.networkTvl ?? 0);
      setActiveNodes(data?.activeNodes ?? 0);
      setLivePorts(data?.livePorts ?? []);
      setMiners(data?.miners ?? {});
      if (!isComputing) {
        setStatus((data?.activeNodes ?? 0) > 0 ? "SWARM VERIFIED" : "NO HONEST MINERS");
      }
    } catch {
      console.error("Failed to sync state");
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [isComputing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      setUploadedWasm({ name: file.name, base64, size: file.size });
      setLogs(prev => [...prev, `> [FILE] LOADED CUSTOM BINARY: ${file.name} (${file.size} BYTES)`]);
    };
    reader.readAsArrayBuffer(file);
  };

  const injectPayload = async () => {
    const targetName = uploadedWasm ? `${uploadedWasm.name} (${uploadedWasm.size}B)` : 'nexus_hybrid_payload.wasm (822B)';
    setLogs(prev => [...prev, `> [UDP] DISPATCHING ${targetName} (PARAM=${customParam || 'RANDOM'}) TO ELIGIBLE MINERS...`]);
    setIsComputing(true);
    setStatus("VERIFYING PROOFS");

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customParam: customParam ? Number(customParam) : undefined,
          wasmBase64: uploadedWasm?.base64,
          fileName: uploadedWasm?.name
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.verifiedNodes?.length > 0) {
          const honestSummary = data.verifiedNodes
            .map((n: any) => `Node :${n.nodePort} => ${data.exportedFn}()=${n.results?.[0]?.output} (+${n.reward.toLocaleString()} NXC)`)
            .join(' | ');
          setLogs(prev => [
            ...prev,
            `> [OK] SPOT-CHECK PASSED [${data.fileName}]: ${honestSummary}`
          ]);
        }

        if (data.slashedNodes?.length > 0) {
          for (const liar of data.slashedNodes) {
            setLogs(prev => [
              ...prev,
              `> [SLASH] 🚨 LIAR DETECTED ON NODE :${liar.nodePort}! Expected ${liar.expected}, got ${liar.reported}. SLASHED -${liar.penalty.toLocaleString()} NXC & BLACKLISTED!`
            ]);
          }
        }

        setLogs(prev => [
          ...prev,
          `> [PROOF] RECEIPT: ${data.hashResult.substring(0, 24)}...`,
          `> [ECON] CLIENT PAID: -${(data.cost || 0).toLocaleString()} NXC (${data.bytes}B × 50)`
        ]);

        await fetchState();
        setStatus(data.slashedNodes?.length > 0 ? "ROGUE NODE SLASHED!" : "TASK VERIFIED");
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

  const resetLedger = async () => {
    await fetch('/api/state', { method: 'DELETE' });
    setLogs(prev => [...prev, "> [SYS] LEDGER RESET: Wallets & Miner Stakes restored."]);
    fetchState();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-green-500 font-mono p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-6xl w-full border border-green-500/20 bg-black/80 rounded-lg overflow-hidden shadow-2xl shadow-green-500/10">
        
        <div className="bg-gradient-to-r from-gray-900 to-black border-b border-green-500/30 text-white font-bold text-center py-4 text-xl md:text-2xl tracking-[0.2em]">
          NEXUS TITAN :: BFT VERIFIED COMPUTE NETWORK
        </div>

        {/* Top Economy Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-b border-green-500/20 text-center divide-y md:divide-y-0 md:divide-x divide-green-500/20 bg-[#0a0a0a]">
          <div className="p-5 bg-red-900/10">
            <p className="text-gray-500 text-xs tracking-widest mb-1">YOUR CLIENT WALLET</p>
            <p className="text-red-400 text-3xl font-bold">{clientWallet.toLocaleString()} <span className="text-sm">NXC</span></p>
            <p className="text-gray-600 text-[10px] mt-1 uppercase">Pays only for verified honest shards</p>
          </div>
          <div className="p-5 bg-[#070707]">
            <p className="text-gray-500 text-xs tracking-widest mb-1">ELIGIBLE HONEST MINERS</p>
            <p className={`text-3xl font-bold ${activeNodes > 0 ? 'text-green-400' : 'text-red-500'}`}>{activeNodes}</p>
            <p className="text-gray-500 text-[10px] mt-1 uppercase">
              {livePorts.length > 0 ? `LIVE UDP PORTS: ${livePorts.join(', ')}` : 'ALL PORTS OFFLINE'}
            </p>
          </div>
          <div className="p-5 bg-green-900/10">
            <p className="text-gray-500 text-xs tracking-widest mb-1">TOTAL SETTLED TVL</p>
            <p className="text-yellow-400 text-3xl font-bold">{tvl.toLocaleString()} <span className="text-sm">NXC</span></p>
            <p className="text-gray-600 text-[10px] mt-1 uppercase">Cumulative verified compute volume</p>
          </div>
        </div>

        {/* Individual Miner Node Ledger Table */}
        <div className="border-b border-green-500/20 bg-[#060606] p-4">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-3">LIVE MINER NODE REGISTRY (PER-NODE WALLETS & STAKING)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[6969, 6970, 6971].map((port) => {
              const m = miners[String(port)] || { wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 };
              const isOnline = livePorts.includes(port);
              return (
                <div key={port} className={`p-3 rounded border ${
                  m.slashed ? 'border-red-600 bg-red-950/20' :
                  isOnline ? 'border-green-500/40 bg-green-950/10' : 'border-gray-800 bg-black/40'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white">NODE :{port}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      m.slashed ? 'bg-red-600 text-white' :
                      isOnline ? 'bg-green-600/20 text-green-400 border border-green-500/40' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {m.slashed ? 'SLASHED / BANNED' : isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-gray-300">
                    <div className="flex justify-between"><span>Earned Wallet:</span><span className="text-yellow-400 font-bold">{m.wallet.toLocaleString()} NXC</span></div>
                    <div className="flex justify-between"><span>Staked Collateral:</span><span className={m.slashed ? 'text-red-400 font-bold' : 'text-green-400'}>{m.staked.toLocaleString()} NXC</span></div>
                    <div className="flex justify-between"><span>Trust / Tasks:</span><span>{m.trust}% ({m.tasksCompleted} runs)</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logs & Status */}
        <div className="flex flex-col md:flex-row h-72">
          <div className="w-full md:w-2/3 p-5 bg-[#020202] overflow-y-auto text-xs leading-relaxed">
            {logs.map((log, i) => (
              <p key={i} className={`mb-1.5 ${
                log.includes('[SLASH]') || log.includes('[ERR]') ? 'text-red-500 font-bold' :
                log.includes('[OK]') ? 'text-cyan-400 font-bold' :
                log.includes('[FILE]') ? 'text-purple-400 font-bold' :
                log.includes('[ECON]') ? 'text-yellow-300' : 'text-green-500/80'
              }`}>
                {log}
              </p>
            ))}
          </div>
          <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-green-500/20 flex flex-col justify-center items-center bg-[#070707] p-6 gap-4">
            <div className="text-center">
              <p className="text-gray-500 text-xs tracking-widest mb-2">CONSENSUS STATUS</p>
              <div className={`px-4 py-2 rounded-full border ${
                status.includes('SLASHED') || activeNodes === 0 ? 'border-red-500 text-red-500' :
                isComputing ? 'border-cyan-500 text-cyan-400 animate-pulse' : 'border-green-500 text-green-500'
              } text-xs font-bold tracking-wider`}>
                {status}
              </div>
            </div>
            <button
              onClick={resetLedger}
              className="text-[11px] text-gray-400 hover:text-white border border-gray-700 hover:border-gray-400 px-3 py-1 rounded transition-all"
            >
              🔄 RESET WALLETS & UNBAN NODES
            </button>
          </div>
        </div>

        {/* Action Controls + Custom WASM Upload */}
        <div className="p-5 bg-[#0a0a0a] border-t border-green-500/20 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Param (u32):</label>
              <input
                type="number"
                value={customParam}
                onChange={(e) => setCustomParam(e.target.value)}
                className="bg-black border border-green-500/40 text-green-400 px-3 py-1.5 rounded w-24 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 uppercase tracking-wider">WASM Binary:</label>
              <input
                type="file"
                accept=".wasm"
                onChange={handleFileUpload}
                className="text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-green-500/40 file:text-xs file:bg-green-950/30 file:text-green-400 hover:file:bg-green-900/40"
              />
              {uploadedWasm && (
                <button
                  onClick={() => setUploadedWasm(null)}
                  className="text-[10px] text-red-400 underline"
                >
                  Use Default (822B)
                </button>
              )}
            </div>
          </div>
          <button
            onClick={injectPayload}
            disabled={isComputing}
            className={`font-bold py-3 px-8 border-2 transition-all uppercase tracking-widest text-sm ${
              isComputing
                ? 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-green-600/10 hover:bg-green-600 border-green-600 text-green-500 hover:text-white shadow-[0_0_15px_rgba(0,255,128,0.2)]'
            }`}
          >
            {isComputing ? 'VERIFYING SWARM...' : '⚡ DISPATCH & VERIFY WASM'}
          </button>
        </div>
      </div>
    </div>
  );
}
