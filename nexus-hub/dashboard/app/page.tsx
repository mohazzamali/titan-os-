'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [logs, setLogs] = useState<string[]>([
    "[OMEGA v7.0] 64-BYTE Ed25519 CRYPTOGRAPHIC SIGNATURES ARMED (Master Blueprint Sec 3.2).",
    "[TENSOR ENGINE] AI Transformer Attention (Q x K^T GEMM) & GOPS Benchmark Ready.",
    "[WAN BRIDGE] Dual-Transport (UDP :6999 + Global HTTPS /api/state) Active."
  ]);
  const [status, setStatus] = useState("SCANNING SWARM");
  const [blockHeight, setBlockHeight] = useState(1);
  const [merkleSeal, setMerkleSeal] = useState("0000...");
  const [tamperAlert, setTamperAlert] = useState(false);
  const [clientWallet, setClientWallet] = useState(100);
  const [circulatingSupply, setCirculatingSupply] = useState(21000000);
  const [totalBurned, setTotalBurned] = useState(0);
  const [nxcUsdPrice, setNxcUsdPrice] = useState(2.50);
  const [fairTaskUsdCost, setFairTaskUsdCost] = useState(0.08);
  const [totalUsdSavedVsAws, setTotalUsdSavedVsAws] = useState(0);
  const [totalSwarmGops, setTotalSwarmGops] = useState(0);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [miners, setMiners] = useState<Record<string, any>>({});
  const [schedulerAudit, setSchedulerAudit] = useState<any>(null);
  const [lastDiagnostic, setLastDiagnostic] = useState<{ expected: string; reported: string; fraud: boolean; port: number; rescuedBy?: number } | null>(null);
  const [synthMode, setSynthMode] = useState("ai_tensor_gemm");
  const [dataVectorStr, setDataVectorStr] = useState("10, 25, 50, 100");
  const [vectorResult, setVectorResult] = useState<{ input: number[]; output: number[] } | null>(null);
  const [enablePruning, setEnablePruning] = useState(true);
  const [customParam, setCustomParam] = useState<string>("42");
  const [uploadedWasm, setUploadedWasm] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setBlockHeight(data?.blockHeight ?? 1);
      setMerkleSeal(data?.merkleStateSeal ?? "");
      setTamperAlert(Boolean(data?.tamperAlert));
      setClientWallet(data?.clientWallet ?? 100);
      setCirculatingSupply(data?.circulatingSupply ?? 21000000);
      setTotalBurned(data?.totalBurned ?? 0);
      setNxcUsdPrice(data?.nxcUsdPrice ?? 2.50);
      setFairTaskUsdCost(data?.fairTaskUsdCost ?? 0.08);
      setTotalUsdSavedVsAws(data?.totalUsdSavedVsAws ?? 0);
      setTotalSwarmGops(data?.totalSwarmGops ?? 0);
      setActiveNodes(data?.activeNodes ?? 0);
      setLivePorts(data?.livePorts ?? []);
      setMiners(data?.miners ?? {});
      if (data?.lastSchedulerAudit) setSchedulerAudit(data.lastSchedulerAudit);
      if (!isComputing) {
        setStatus((data?.activeNodes ?? 0) > 0 ? "OMEGA SWARM READY" : "NO HONEST MINERS");
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
      const chunks = Math.ceil(file.size / 1024);
      setUploadedWasm({ name: file.name, base64: btoa(binary), size: file.size });
      setLogs(prev => [...prev, `[WASM LOADER] Loaded ${file.name} (${file.size}B -> ${chunks} UDP Chunk${chunks > 1 ? 's' : ''})`]);
    };
    reader.readAsArrayBuffer(file);
  };

  const injectPayload = async () => {
    setIsComputing(true);
    setStatus("VERIFYING ED25519 + TENSOR DAG");

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customParam: customParam ? Number(customParam) : undefined,
          wasmBase64: uploadedWasm?.base64,
          fileName: uploadedWasm?.name,
          enablePruning,
          synthMode,
          dataVectorStr
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.schedulerAudit) setSchedulerAudit(data.schedulerAudit);
        if (data.telemetryLogs) setLogs(prev => [...prev, ...data.telemetryLogs]);
        if (data.inputVector && data.outputVector) {
          setVectorResult({ input: data.inputVector, output: data.outputVector });
        }

        if (data.slashedNodes?.length > 0) {
          const liar = data.slashedNodes[0];
          const rescueNode = data.verifiedNodes?.find((v: any) => v.rescuedFrom === liar.nodePort);
          setLastDiagnostic({
            expected: liar.expected,
            reported: liar.reported,
            fraud: true,
            port: liar.nodePort,
            rescuedBy: rescueNode?.nodePort
          });
          setStatus("SLASHED & ED25519 HEALED!");
        } else if (data.verifiedNodes?.length > 0) {
          const v = data.verifiedNodes[0];
          setLastDiagnostic({
            expected: v.expectedOutput,
            reported: v.results?.[0]?.output,
            fraud: false,
            port: v.nodePort
          });
          setStatus("100% OMEGA SETTLED");
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
    setVectorResult(null);
    setLogs(["[SYS] GENESIS BLOCK #1 RESTORED: Ed25519 Registry & 21M NXC Cap Reset."]);
    fetchState();
  };

  const allKnownPorts = Array.from(
    new Set([6969, 6970, 6971, ...Object.keys(miners).map(Number), ...livePorts])
  ).sort();

  const currentNxcPerTask = (fairTaskUsdCost / nxcUsdPrice).toFixed(4);

  return (
    <div className="min-h-screen bg-[#050505] text-green-500 font-mono p-4 md:p-6 flex flex-col items-center">
      <div className="max-w-7xl w-full border border-green-500/20 bg-black/90 rounded-lg overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-green-500/30 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <div>
            <h1 className="text-white font-bold text-lg md:text-xl tracking-[0.15em]">
              NEXUS TITAN // v7.0 OMEGA // ED25519 & AI TENSOR SUPER-FABRIC
            </h1>
            <p className="text-[10px] text-cyan-400 tracking-widest">
              64B ED25519 SIGNATURES • AI TRANSFORMER TENSOR GEMM • WAN HTTP+UDP BRIDGE • L1 SMART CONTRACT CALLDATA
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] px-2.5 py-1 rounded border font-bold ${
              tamperAlert ? 'bg-red-900/40 border-red-500 text-red-300' : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
            }`}>
              {tamperAlert ? '⚠️ LEDGER TAMPERED!' : `⛓️ L1 BLOCK #${blockHeight} SEALED: ${merkleSeal.substring(0, 10)}...`}
            </span>
            <button
              onClick={resetLedger}
              className="text-xs text-gray-300 hover:text-white border border-gray-700 px-3 py-1 rounded"
            >
              🔄 RESET GENESIS
            </button>
          </div>
        </div>

        {/* Top 4 Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 border-b border-green-500/20 text-center divide-y md:divide-y-0 md:divide-x divide-green-500/20 bg-[#0a0a0a]">
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">BUYER WALLET (FRACTIONAL NXC)</p>
            <p className="text-green-400 text-2xl font-bold">{clientWallet.toFixed(4)} NXC</p>
            <p className="text-[10px] text-gray-400 mt-1">
              Power: ${(clientWallet * nxcUsdPrice).toFixed(2)} USD (~{Math.floor((clientWallet * nxcUsdPrice) / fairTaskUsdCost)} Runs)
            </p>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">NXC ORACLE PRICE & EFFICIENCY</p>
            <p className="text-yellow-400 text-2xl font-bold">${nxcUsdPrice.toFixed(4)} <span className="text-xs text-green-400">↑</span></p>
            <p className="text-[10px] text-cyan-400 mt-1 font-bold">
              Only {currentNxcPerTask} NXC ($0.08 vs $0.45 AWS)
            </p>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">SWARM AI TENSOR SPEED ⚡</p>
            <p className="text-purple-400 text-2xl font-bold">{totalSwarmGops.toFixed(2)} GOPS</p>
            <p className="text-[10px] text-green-400 mt-1">
              Saved vs AWS: ${totalUsdSavedVsAws.toFixed(2)} USD (82% Less)
            </p>
          </div>
          <div className="p-4">
            <p className="text-gray-500 text-[10px] tracking-widest">BURNED / 21M SUPPLY CAP 🔥</p>
            <p className="text-red-500 text-2xl font-bold">{totalBurned.toFixed(4)} NXC</p>
            <p className="text-[10px] text-gray-400 mt-1">
              Circulating: {circulatingSupply.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
          </div>
        </div>

        {/* Ed25519 Signed NCIP Nodes */}
        <div className="border-b border-green-500/20 bg-[#060606] p-4">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-3">
            ED25519 CRYPTOGRAPHIC MINER NODES ({activeNodes} HONEST ONLINE) — 64-BYTE SIGNATURE VERIFICATION & SELF-HEALING
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {allKnownPorts.map((port) => {
              const m = miners[String(port)] || { host: '127.0.0.1', wallet: 0, staked: 1000, trust: 100, slashed: false, tasksCompleted: 0, rescuesCompleted: 0, ed25519VerifiedCount: 0, gopsThroughput: 0 };
              const isOnline = livePorts.includes(port);
              const cores = m.cores || (port === 6969 ? 32 : port === 6970 ? 10 : 8);
              const thermal = m.thermal ? `${m.thermal}°C` : (port === 6969 ? '65°C' : port === 6970 ? '42°C' : '35°C');
              const execPath = m.executionPath || (port === 6969 ? 'PATH-A (Ring-0 + SIMD Tensor)' : 'PATH-B (OS MicroVM + WebGPU)');
              return (
                <div key={port} className={`p-3 rounded border ${
                  m.slashed ? 'border-red-600 bg-red-950/20' :
                  isOnline ? 'border-green-500/40 bg-green-950/10' : 'border-gray-800 bg-black/40'
                }`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white text-sm">
                      NODE {m.host || '127.0.0.1'}:{port}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      m.slashed ? 'bg-red-600 text-white' :
                      isOnline ? 'bg-green-600/20 text-green-400 border border-green-500/40' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {m.slashed ? 'SLASHED & BURNED' : isOnline ? 'ED25519 VERIFIED' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-cyan-400 truncate mb-0.5">{m.did || `did:nexus:ed25519:${port}`}</p>
                  <p className="text-[10px] text-gray-500 mb-2">{execPath}</p>
                  <div className="text-[11px] space-y-1 text-gray-300">
                    <div className="flex justify-between"><span>Specs / Speed:</span><span className="text-cyan-400">{cores} Cores ({thermal}) | {m.gopsThroughput || 0} GOPS</span></div>
                    <div className="flex justify-between"><span>Earned Wallet:</span><span className="text-yellow-400 font-bold">{Number(m.wallet).toFixed(4)} NXC (${(Number(m.wallet) * nxcUsdPrice).toFixed(2)})</span></div>
                    <div className="flex justify-between"><span>Ed25519 / Rescues:</span><span className="text-purple-400 font-bold">{m.ed25519VerifiedCount || 0} Sigs | {m.rescuesCompleted || 0} Rescues</span></div>
                    <div className="flex justify-between"><span>Staked Collateral:</span><span className={m.slashed ? 'text-red-400 font-bold' : 'text-green-400'}>{m.staked} NXC ({m.trust}% Trust)</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic & Self-Healing Banner */}
        {lastDiagnostic && (
          <div className={`border-b border-green-500/20 p-4 ${lastDiagnostic.fraud ? 'bg-red-950/30' : 'bg-green-950/20'}`}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                L1 SPOT-CHECK // EXPECTED: <span className="text-green-400">{lastDiagnostic.expected} ✓</span> vs P{lastDiagnostic.port}: <span className={lastDiagnostic.fraud ? 'text-red-400' : 'text-green-400'}>{lastDiagnostic.reported}</span>
              </span>
              {lastDiagnostic.fraud && lastDiagnostic.rescuedBy && (
                <span className="text-xs bg-green-900/50 border border-green-400 text-green-200 px-3 py-1 rounded font-bold">
                  🛡️ SELF-HEALED BY ED25519 HERO P{lastDiagnostic.rescuedBy} (+5 NXC BOUNTY) — 100% JOB COMPLETED!
                </span>
              )}
            </div>
          </div>
        )}

        {/* Vector Batch Output Bar */}
        {vectorResult && (
          <div className="border-b border-green-500/20 bg-[#08080c] px-6 py-2.5 flex flex-col md:flex-row justify-between items-center text-xs">
            <span className="text-gray-400">TENSOR VECTOR IN: <span className="text-cyan-400 font-bold">[{vectorResult.input.join(', ')}]</span></span>
            <span className="text-gray-400">ED25519 VERIFIED TENSOR OUT: <span className="text-yellow-300 font-bold">[{vectorResult.output.join(', ')}]</span></span>
          </div>
        )}

        {/* Logs & L1 Smart Contract Calldata Audit */}
        <div className="grid grid-cols-1 lg:grid-cols-3 h-64 divide-y lg:divide-y-0 lg:divide-x divide-green-500/20">
          <div className="lg:col-span-2 p-4 bg-[#020202] overflow-y-auto text-xs leading-relaxed">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1 mb-2">
              <span className="text-[11px] text-white font-bold">NEXUS_Telemetry.log (v7.0 OMEGA)</span>
              <span className="text-[10px] text-cyan-400">{status}</span>
            </div>
            {logs.map((log, i) => (
              <p key={i} className={`mb-1.5 ${
                log.includes('[BFT SLASH-BURN]') || log.includes('[ERR]') ? 'text-red-500 font-bold' :
                log.includes('[SELF-HEALING FAILOVER]') ? 'text-green-300 font-bold' :
                log.includes('[L1 ANCHOR CALLDATA]') ? 'text-cyan-300 font-bold' :
                log.includes('🏆 [ED25519') ? 'text-yellow-300 font-bold' : 'text-green-400'
              }`}>
                {log}
              </p>
            ))}
          </div>

          <div className="p-4 bg-[#050508] overflow-y-auto text-[11px]">
            <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold mb-2">
              L1 CALLDATA & ED25519 AUDIT
            </p>
            {schedulerAudit ? (
              <pre className="text-[10px] text-green-300/90 whitespace-pre-wrap bg-black/60 p-2 rounded border border-purple-500/20">
                {JSON.stringify(schedulerAudit, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-600 text-xs mt-8 text-center">
                Execute pipeline to inspect 64B Ed25519 Signatures, AI Tensor GOPS & L1 Calldata.
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 bg-[#0a0a0a] border-t border-green-500/20 flex flex-col xl:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Workload Engine:</span>
              <select
                value={synthMode}
                onChange={(e) => { setSynthMode(e.target.value); setUploadedWasm(null); }}
                className="bg-black border border-cyan-500/40 text-cyan-300 px-2 py-1 rounded"
              >
                <option value="ai_tensor_gemm">🧠 AI Transformer Attention Tensor (Q×K^T GEMM)</option>
                <option value="rust_matrix">⚙️ 4x4 Matrix Kernel (822B Rust)</option>
                <option value="xor_cipher">🔐 Instant Synth: XOR Stream Cipher</option>
                <option value="neural_relu">⚡ Instant Synth: Neural ReLU Layer</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Tensor Vector:</span>
              <input
                type="text"
                value={dataVectorStr}
                onChange={(e) => setDataVectorStr(e.target.value)}
                className="bg-black border border-green-500/40 text-yellow-300 px-2 py-1 rounded w-36"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Param:</span>
              <input
                type="number"
                value={customParam}
                onChange={(e) => setCustomParam(e.target.value)}
                className="bg-black border border-green-500/40 text-green-400 px-2 py-1 rounded w-16"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                accept=".wasm"
                onChange={handleFileUpload}
                className="text-xs text-gray-400 w-44 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-green-500/40 file:text-xs file:bg-green-950/30 file:text-green-400"
              />
            </div>
          </div>
          <button
            onClick={injectPayload}
            disabled={isComputing}
            className="font-bold py-3 px-6 border-2 bg-green-600/10 hover:bg-green-600 border-green-600 text-green-500 hover:text-white transition-all uppercase tracking-widest text-xs whitespace-nowrap"
          >
            {isComputing ? 'VERIFYING ED25519 + TENSOR...' : `⚡ EXECUTE OMEGA DAG (~${currentNxcPerTask} NXC)`}
          </button>
        </div>
      </div>
    </div>
  );
}
