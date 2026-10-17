'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([
    "[SCHEDULER] NEXUS v4.0 DEFLATIONARY COMPUTE PIPELINE READY.",
    "[NAT-PUNCH] Listening on UDP :6999 for Outbound Miner Beacons (Zero Router Config).",
    "[TOKENOMICS] 21,000,000 NXC Cap | 30% Fee Burn + 100% Slash Burn Active."
  ]);
  const [status, setStatus] = useState("SCANNING SWARM");
  const [clientWallet, setClientWallet] = useState(5000);
  const [circulatingSupply, setCirculatingSupply] = useState(21000000);
  const [totalBurned, setTotalBurned] = useState(0);
  const [nxcUsdPrice, setNxcUsdPrice] = useState(2.40);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [miners, setMiners] = useState<Record<string, any>>({});
  const [schedulerAudit, setSchedulerAudit] = useState<any>(null);
  const [lastDiagnostic, setLastDiagnostic] = useState<{ expected: string; reported: string; fraud: boolean; port: number } | null>(null);
  const [enablePruning, setEnablePruning] = useState(true);
  const [customParam, setCustomParam] = useState<string>("42");
  const [uploadedWasm, setUploadedWasm] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setClientWallet(data?.clientWallet ?? 5000);
      setCirculatingSupply(data?.circulatingSupply ?? 21000000);
      setTotalBurned(data?.totalBurned ?? 0);
      setNxcUsdPrice(data?.nxcUsdPrice ?? 2.40);
      setActiveNodes(data?.activeNodes ?? 0);
      setLivePorts(data?.livePorts ?? []);
      setMiners(data?.miners ?? {});
      if (data?.lastSchedulerAudit) setSchedulerAudit(data.lastSchedulerAudit);
      if (!isComputing) {
        setStatus((data?.activeNodes ?? 0) > 0 ? "SWARM VERIFIED" : "NO HONEST MINERS");
      }
    } catch {}
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
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      setUploadedWasm({ name: file.name, base64: btoa(binary), size: file.size });
      setLogs(prev => [...prev, `[WASM LOADER] Custom Binary Ready: ${file.name} (${file.size}B)`]);
    };
    reader.readAsArrayBuffer(file);
  };

  const injectPayload = async () => {
    setIsComputing(true);
    setStatus("EXECUTING DAG");

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customParam: customParam ? Number(customParam) : undefined,
          wasmBase64: uploadedWasm?.base64,
          fileName: uploadedWasm?.name,
          enablePruning
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.schedulerAudit) setSchedulerAudit(data.schedulerAudit);
        if (data.telemetryLogs) setLogs(prev => [...prev, ...data.telemetryLogs]);

        if (data.slashedNodes?.length > 0) {
          const liar = data.slashedNodes[0];
          setLastDiagnostic({
            expected: liar.expected,
            reported: liar.reported,
            fraud: true,
            port: liar.nodePort
          });
          setStatus("BFT FRAUD BURNED!");
        } else if (data.verifiedNodes?.length > 0) {
          const v = data.verifiedNodes[0];
          setLastDiagnostic({
            expected: v.expectedOutput,
            reported: v.results?.[0]?.output,
            fraud: false,
            port: v.nodePort
          });
          setStatus("DEFLATIONARY SETTLED");
        }

        await fetchState();
      } else {
        setStatus("HALTED");
        setLogs(prev => [...prev, `[ERR] ${data.error || data.message}`]);
      }
    } catch (err: any) {
      setStatus("OFFLINE");
      setLogs(prev => [...prev, `[ERR] ${err.message}`]);
    }
    setIsComputing(false);
  };

  const resetLedger = async () => {
    await fetch('/api/state', { method: 'DELETE' });
    setSchedulerAudit(null);
    setLastDiagnostic(null);
    setLogs(["[SYS] GENESIS RESTORED: 21,000,000 NXC Supply & Node Stakes Reset."]);
    fetchState();
  };

  const allKnownPorts = Array.from(
    new Set([6969, 6970, 6971, ...Object.keys(miners).map(Number), ...livePorts])
  ).sort();

  return (
    <div className="min-h-screen bg-[#050505] text-green-500 font-mono p-4 md:p-6 flex flex-col items-center">
      <div className="max-w-7xl w-full border border-green-500/20 bg-black/90 rounded-lg overflow-hidden shadow-2xl">
        
        <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-green-500/30 px-6 py-4 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 className="text-white font-bold text-lg md:text-xl tracking-[0.15em]">
              NEXUS TITAN // v4.0 // DEFLATIONARY COMPUTE FABRIC
            </h1>
            <p className="text-[10px] text-cyan-400 tracking-widest">
              HIGH-DENSITY PoUC (50x WORK/NXC) • EIP-1559 30% FEE BURN • OUTBOUND NAT HOLE-PUNCHING (:6999)
            </p>
          </div>
          <button
            onClick={resetLedger}
            className="text-xs text-gray-300 hover:text-white border border-gray-700 px-3 py-1 rounded mt-2 md:mt-0"
          >
            🔄 RESET GENESIS LEDGER
          </button>
        </div>

        {/* Deflationary Tokenomics & Scarcity Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 border-b border-green-500/20 text-center divide-y md:divide-y-0 md:divide-x divide-green-500/20 bg-[#0a0a0a]">
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">BUYER HIGH-VALUE WALLET</p>
            <p className="text-green-400 text-2xl font-bold">{clientWallet.toLocaleString()} NXC</p>
            <p className="text-[10px] text-gray-500 mt-1">≈ ${(clientWallet * nxcUsdPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })} USD Purchasing Power</p>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">NXC SCARCITY VALUE (LIVE)</p>
            <p className="text-yellow-400 text-2xl font-bold">${nxcUsdPrice.toFixed(4)} <span className="text-xs text-green-400">↑</span></p>
            <p className="text-[10px] text-gray-500 mt-1">1 NXC = 20,000 Matrix Ops</p>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">TOTAL NXC BURNED 🔥</p>
            <p className="text-red-500 text-2xl font-bold">{totalBurned.toLocaleString()} NXC</p>
            <p className="text-[10px] text-gray-500 mt-1">30% Task Fee + 100% Slashed Stake</p>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">CIRCULATING SUPPLY (21M CAP)</p>
            <p className="text-cyan-400 text-2xl font-bold">{circulatingSupply.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 mt-1">Deflationary Bitcoin-Style Cap</p>
          </div>
        </div>

        {/* NCIP Capability Passports & Asymmetric Load Balancing Cards */}
        <div className="border-b border-green-500/20 bg-[#060606] p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-gray-400 tracking-widest uppercase">
              NAT-PUNCHED NCIP NODES ({activeNodes} HONEST ONLINE) — Score = ((Cores × Trust) / (Thermal + 1)) × (1000 / Complexity)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {allKnownPorts.map((port) => {
              const m = miners[String(port)] || { wallet: 0, staked: 5000, trust: 100, slashed: false, tasksCompleted: 0 };
              const isOnline = livePorts.includes(port);
              const cores = m.cores || (port === 6969 ? 32 : port === 6970 ? 10 : 8);
              const thermal = m.thermal ? `${m.thermal}°C` : (port === 6969 ? '65°C' : port === 6970 ? '42°C' : '35°C');
              const battery = m.battery ? `${m.battery}%` : '90%';
              return (
                <div key={port} className={`p-3 rounded border ${
                  m.slashed ? 'border-red-600 bg-red-950/20' :
                  isOnline ? 'border-green-500/40 bg-green-950/10' : 'border-gray-800 bg-black/40'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white text-sm">
                      NODE P{port} {port === 6969 ? '(Heavy Rig)' : port === 6970 ? '(Workstation)' : port === 6971 ? '(Mobile Edge)' : '(Dynamic NAT)'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      m.slashed ? 'bg-red-600 text-white' :
                      isOnline ? 'bg-green-600/20 text-green-400 border border-green-500/40' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {m.slashed ? 'SLASHED & BURNED' : isOnline ? 'NAT-PUNCH ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1 text-gray-300">
                    <div className="flex justify-between"><span>CPU / Thermal / Energy:</span><span className="text-cyan-400">{cores} Threads | {thermal} | {battery}</span></div>
                    <div className="flex justify-between"><span>Asymmetric Score:</span><span className="text-purple-400 font-bold">{m.computedUtility ?? '—'}</span></div>
                    <div className="flex justify-between"><span>Earned Wallet:</span><span className="text-yellow-400 font-bold">{m.wallet.toLocaleString()} NXC (${(m.wallet * nxcUsdPrice).toFixed(2)})</span></div>
                    <div className="flex justify-between"><span>Staked / SLA Trust:</span><span className={m.slashed ? 'text-red-400 font-bold' : 'text-green-400'}>{m.staked.toLocaleString()} NXC ({m.trust}%)</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Interface */}
        {lastDiagnostic && (
          <div className={`border-b border-green-500/20 p-4 ${lastDiagnostic.fraud ? 'bg-red-950/30' : 'bg-green-950/20'}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2 text-white">
              DIAGNOSTIC INTERFACE // L1 VERIFIABLE TRUST & DEFLATIONARY SLASH-BURN (NODE P{lastDiagnostic.port})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-black/70 border border-green-500/40 rounded flex justify-between items-center">
                <span className="text-xs text-gray-400">L1 Consensus Expected:</span>
                <span className="text-lg font-bold text-green-400">{lastDiagnostic.expected} ✓</span>
              </div>
              <div className={`p-3 bg-black/70 border rounded flex justify-between items-center ${lastDiagnostic.fraud ? 'border-red-500' : 'border-green-500/40'}`}>
                <span className="text-xs text-gray-400">P{lastDiagnostic.port} Node Output:</span>
                <span className={`text-lg font-bold ${lastDiagnostic.fraud ? 'text-red-500' : 'text-green-400'}`}>
                  {lastDiagnostic.reported} {lastDiagnostic.fraud ? '✗' : '✓'}
                </span>
              </div>
            </div>
            {lastDiagnostic.fraud && (
              <div className="mt-2 p-2 bg-red-900/40 border border-red-500 text-red-200 text-xs font-bold text-center tracking-wider">
                🔥 [BFT SLASH-BURN] MALICIOUS FRAUD EXPELLED! 2,500 STAKED NXC PERMANENTLY BURNED FROM SUPPLY!
              </div>
            )}
          </div>
        )}

        {/* Telemetry & JSON Audit */}
        <div className="grid grid-cols-1 lg:grid-cols-3 h-72 divide-y lg:divide-y-0 lg:divide-x divide-green-500/20">
          <div className="lg:col-span-2 p-4 bg-[#020202] overflow-y-auto text-xs leading-relaxed">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1 mb-2">
              <span className="text-[11px] text-white font-bold">NEXUS_Telemetry.log</span>
              <span className="text-[10px] text-cyan-400">{status}</span>
            </div>
            {logs.map((log, i) => (
              <p key={i} className={`mb-1.5 ${
                log.includes('[BFT DETECTED]') || log.includes('[ERR]') ? 'text-red-500 font-bold' :
                log.includes('[DEFLATION ENGINE]') ? 'text-orange-400 font-bold' :
                log.includes('🏆 [VALID]') ? 'text-yellow-300 font-bold' :
                log.includes('[PASSPORT]') ? 'text-cyan-400' :
                log.includes('[SCHEDULER]') ? 'text-purple-400 font-bold' : 'text-green-400'
              }`}>
                {log}
              </p>
            ))}
          </div>

          <div className="p-4 bg-[#050508] overflow-y-auto text-[11px]">
            <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mb-2">
              ASYMMETRIC DAG & DEFLATION AUDIT
            </p>
            {schedulerAudit ? (
              <pre className="text-[10px] text-green-300/90 whitespace-pre-wrap bg-black/60 p-2 rounded border border-purple-500/20">
                {JSON.stringify(schedulerAudit, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-600 text-xs mt-8 text-center">
                Execute pipeline to view Asymmetric DAG Allocation & Burn Metrics.
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 bg-[#0a0a0a] border-t border-green-500/20 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enablePruning}
                onChange={(e) => setEnablePruning(e.target.checked)}
                className="accent-green-500"
              />
              Autonomous Branch Pruning
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Param:</span>
              <input
                type="number"
                value={customParam}
                onChange={(e) => setCustomParam(e.target.value)}
                className="bg-black border border-green-500/40 text-green-400 px-2 py-1 rounded w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Custom .wasm:</span>
              <input
                type="file"
                accept=".wasm"
                onChange={handleFileUpload}
                className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-green-500/40 file:text-xs file:bg-green-950/30 file:text-green-400"
              />
            </div>
          </div>
          <button
            onClick={injectPayload}
            disabled={isComputing}
            className="font-bold py-3 px-8 border-2 bg-green-600/10 hover:bg-green-600 border-green-600 text-green-500 hover:text-white transition-all uppercase tracking-widest text-xs"
          >
            {isComputing ? 'EXECUTING ZERO-COPY DAG...' : '⚡ EXECUTE DEFLATIONARY PIPELINE'}
          </button>
        </div>
      </div>
    </div>
  );
}
