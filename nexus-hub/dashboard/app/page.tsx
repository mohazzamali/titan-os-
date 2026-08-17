"use client";
import { useState, useEffect } from "react";

export default function NexusHub() {
  const [isMounted, setIsMounted] = useState(false);
  const [tvl, setTvl] = useState(931.0504);
  const [logs, setLogs] = useState([
    "[SYS] NEXUS HUB // MATCHMAKER CLOUD HYBRID ONLINE.",
    "[SEC] CORE NETWORK SYNCHRONIZED. AWAITING PAYLOAD...",
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    let ws: WebSocket | null = null;
    
    try {
      const isProduction = window.location.hostname.includes("vercel.app");
      
      // 👇👇👇 COMMANDER, BAS IS LINE MEIN APNA RENDER URL DAALNA HAI 👇👇👇
      const wsUrl = isProduction 
        ? "wss://nexus-hub-lake-theta.onrender.com" 
        : `ws://${window.location.hostname}:8080`;
      // 👆👆👆 -------------------------------------------------------- 👆👆👆

      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'COMPUTE_RESULT') {
            const time = new Date().toLocaleTimeString();
            setLogs((prev) => [...prev, `[${time}] 🎯 [NETWORK] FINAL RESULT SECURED: ${data.result}`]);
            setFinalResult(data.result);
            setIsDeploying(false);
          }
        } catch (err) {
          console.error("Payload parse error", err);
        }
      };

      ws.onerror = () => {
        setLogs((prev) => [...prev, `❌ [NET] Cloud Relay connection failed.`]);
      };

    } catch (err) {
      console.error("Failed to boot WebSocket", err);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-black text-cyan-400 flex items-center justify-center font-mono text-xl">
        ⚡ INITIALIZING NEXUS MATRIX...
      </main>
    );
  }

  const executePayload = async (payloadFile: File) => {
    setIsDeploying(true);
    setFinalResult(null);
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] 📤 UPLOADING TO GLOBAL SWARM...`]);

    const formData = new FormData();
    formData.append("file", payloadFile);

    try {
      const res = await fetch("/api/deploy", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setLogs((prev) => [...prev, `[${time}] ⚡ ${data.message}`]);
      }
    } catch (err) {
      setLogs((prev) => [...prev, `[${time}] ❌ ERROR: Relay unreachable.`]);
      setIsDeploying(false);
    }
  };

  const handleManualDeploy = () => { if (file) executePayload(file); };

  const handleAutoDeploy = () => {
    try {
      const testWasmBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x0b, 0x01, 0x07, 0x65, 0x78, 0x65, 0x63, 0x75, 0x74, 0x65, 0x00, 0x00, 0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x01, 0x0b]);
      const blob = new Blob([testWasmBytes], { type: "application/wasm" });
      const dummyFile = new File([blob], "mobile_task.wasm", { type: "application/wasm" });
      executePayload(dummyFile);
    } catch (err) {
      console.error("Payload execution failed", err);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col gap-6 bg-black text-white">
      <header className="border-b border-cyan-800 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-cyan-400">NEXUS HUB</h1>
          <p className="text-xs md:text-sm text-gray-400 mt-2">Decentralized Bare-Metal Marketplace</p>
        </div>
        {finalResult && (
          <div className="bg-green-900/30 border border-green-500 px-4 py-2 rounded">
            <p className="text-xs text-green-400">Task Output</p>
            <p className="text-xl font-bold text-green-300">RESULT = {finalResult}</p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="col-span-1 lg:col-span-2 bg-black border border-gray-800 p-6 rounded-md shadow-[0_0_15px_rgba(0,255,204,0.1)]">
          <h2 className="text-xl font-semibold mb-4 text-gray-300 border-b border-gray-800 pb-2">📊 TELEMETRY</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Network TVL</p><p className="text-2xl font-bold text-yellow-400">{tvl} NXC</p></div>
            <div><p className="text-gray-500">Global Hashrate</p><p className="text-lg text-cyan-300">142.8 TFLOPS</p></div>
          </div>
        </section>

        <section className="col-span-1 bg-black border border-gray-800 p-6 rounded-md flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-300 border-b border-gray-800 pb-2">⚡ DEPLOY</h2>
            <input type="file" accept=".wasm" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-cyan-900 file:text-cyan-100 hover:file:bg-cyan-700 cursor-pointer"/>
          </div>
          <div className="flex flex-col gap-3">
              <button onClick={handleManualDeploy} disabled={isDeploying || !file} className={`w-full font-bold py-2 rounded border transition-all ${isDeploying ? 'bg-cyan-900 text-cyan-400 animate-pulse' : 'bg-cyan-900 text-cyan-100 hover:bg-cyan-700 border-cyan-500 active:scale-95 disabled:opacity-50'}`}>
                DEPLOY CUSTOM FILE
              </button>
              <button onClick={handleAutoDeploy} disabled={isDeploying} className={`w-full font-bold py-2 rounded border transition-all ${isDeploying ? 'bg-purple-900 text-purple-400 animate-pulse' : 'bg-purple-900 text-purple-100 hover:bg-purple-700 border-purple-500 active:scale-95'}`}>
                🚀 FIRE BUILT-IN MOBILE PAYLOAD
              </button>
          </div>
        </section>
      </div>

      <section className="bg-black border border-gray-800 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm flex flex-col">
        {logs.map((log, i) => (<div key={i}><span className="text-green-500">➜ </span><span className="text-gray-300">{log}</span></div>))}
      </section>
    </main>
  );
}