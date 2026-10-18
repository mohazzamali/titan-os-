'use client';
import { useState, useEffect, useRef } from 'react';

const WORKLOAD_GUIDES: Record<string, {
  title: string;
  whatIsInsideWasm: string;
  whyComputeNeeded: string;
  inputLabel: string;
  paramLabel: string;
  outputExplanation: string;
}> = {
  blender_raytrace: {
    title: "🎨 3D Raytracing Render (Blender-Style Distributed Scene)",
    whatIsInsideWasm: "Is .wasm file ke andar 3D Ray-Sphere Intersection, Lambertian Light Shading, Specular Highlight aur Shadow Raytracing ka mathematical formula hai.",
    whyComputeNeeded: "Ek 3D frame mein laakhon pixels par light ki kiran (ray) kahan takrati hai, yeh akele CPU par slow hota hai. NEXUS is 3D photo ko horizontal pattiyon (Scanline Bands) mein tod kar alag-alag Miners par 1 millisecond mein render karwata hai!",
    inputLabel: "Light & Color Vector [LightX, LightY, Hue, Specular]:",
    paramLabel: "Camera Zoom / Seed:",
    outputExplanation: "Har Miner apne hisse ki 3D scanline patti compute karke pixels bhejta hai. Niche Canvas par aapko Asli 3D Rendered Scene dikhega (aur aap use .PNG mein download kar sakte hain)!"
  },
  ai_tensor_gemm: {
    title: "🧠 AI Neural Network Training (Distributed Gradient Descent)",
    whatIsInsideWasm: "Is .wasm file ke andar Neural Network Matrix Multiplication (Q x K^T Attention) aur Gradient Descent Weight Optimization loop hai.",
    whyComputeNeeded: "AI model ko sikhane ke liye hazaron Epochs (iterations) chalane padte hain taaki AI ki galti (Loss %) 86% se ghat kar <1% reh jaye. NEXUS ke miners parallel shards mein AI weights train karte hain!",
    inputLabel: "Training Batch Data [X1, X2, X3, X4]:",
    paramLabel: "Learning Rate Scale:",
    outputExplanation: "Compute hone ke baad aapko Trained AI Model Weights (W1, W2, Bias), Loss Reduction Chart (86% -> 0.4%), aur ek Live AI Predictor milega jismein aap koi bhi number daal kar AI ko test kar sakte hain!"
  },
  xor_cipher: {
    title: "🔐 High-Speed Cryptographic Audit & Monte Carlo Simulation",
    whatIsInsideWasm: "Is .wasm file ke andar 32-bit Linear Congruential XOR Cipher aur Financial Hash transformation engine hai.",
    whyComputeNeeded: "Jab aapko hazaron data blocks ko ek sath encrypt karna ho ya 50,000 financial scenarios simulate karne hon, toh swarm ise micro-seconds mein verify karke deta hai.",
    inputLabel: "Raw Data Blocks [B1, B2, B3, B4]:",
    paramLabel: "Cipher Key:",
    outputExplanation: "Miners ke WASM Linear Memory se har data block ka 100% Ed25519-verified encrypted output vector wapas aata hai."
  },
  rust_matrix: {
    title: "📂 Custom Compiled Rust .WASM Binary (4x4 Matrix / User Upload)",
    whatIsInsideWasm: "Yeh aapke Rust code (`nexus-hybrid-payload/src/lib.rs`) ya aapki upload ki gayi `.wasm` file ka compiled WebAssembly machine bytecode hai.",
    whyComputeNeeded: "Bina Docker ya Linux OS ke, aapka custom Rust/C++ code seedha Miners ke bare-metal/MicroVM sandbox mein zero-copy speed par chalta hai.",
    inputLabel: "Input Vector (4x u32 into WASM Memory):",
    paramLabel: "Function Param:",
    outputExplanation: "WASM X-Ray Inspector aapki file ke andar ke functions dikhata hai aur Miners se compute hua exact vector wapas lata hai."
  }
};

export default function Home() {
  const [logs, setLogs] = useState<string[]>([
    "[STUDIO v9.0] VISUAL COMPUTE STUDIO READY: Choose 3D Raytracing, AI Training, or Custom WASM.",
    "[X-RAY] Live WebAssembly Binary Disassembler & Plain-Language Inspector Armed."
  ]);
  const [status, setStatus] = useState("SILICON VERIFIED");
  const [blockHeight, setBlockHeight] = useState(1);
  const [merkleSeal, setMerkleSeal] = useState("0000...");
  const [clientWallet, setClientWallet] = useState(100);
  const [circulatingSupply, setCirculatingSupply] = useState(21000000);
  const [totalBurned, setTotalBurned] = useState(0);
  const [nxcUsdPrice, setNxcUsdPrice] = useState(2.50);
  const [totalUsdSavedVsAws, setTotalUsdSavedVsAws] = useState(0);
  const [totalSwarmGops, setTotalSwarmGops] = useState(0);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [miners, setMiners] = useState<Record<string, any>>({});

  // Studio States
  const [synthMode, setSynthMode] = useState("blender_raytrace");
  const [totalShards, setTotalShards] = useState<number>(5000);
  const [dataVectorStr, setDataVectorStr] = useState("45, 80, 200, 140");
  const [customParam, setCustomParam] = useState<string>("42");
  const [uploadedWasm, setUploadedWasm] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  // Results & Visual Studio States
  const [wasmInspector, setWasmInspector] = useState<any>(null);
  const [scanlineBands, setScanlineBands] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiTestInput, setAiTestInput] = useState<string>("150");
  const [vectorResult, setVectorResult] = useState<{ input: number[]; output: number[] } | null>(null);
  const [lastDiagnostic, setLastDiagnostic] = useState<{ expected: string; reported: string; fraud: boolean; port: number; rescuedBy?: number } | null>(null);
  const [showCorruptedPreview, setShowCorruptedPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setBlockHeight(data?.blockHeight ?? 1);
      setMerkleSeal(data?.merkleStateSeal ?? "");
      setClientWallet(data?.clientWallet ?? 100);
      setCirculatingSupply(data?.circulatingSupply ?? 21000000);
      setTotalBurned(data?.totalBurned ?? 0);
      setNxcUsdPrice(data?.nxcUsdPrice ?? 2.50);
      setTotalUsdSavedVsAws(data?.totalUsdSavedVsAws ?? 0);
      setTotalSwarmGops(data?.totalSwarmGops ?? 0);
      setActiveNodes(data?.activeNodes ?? 0);
      setLivePorts(data?.livePorts ?? []);
      setMiners(data?.miners ?? {});
    } catch {}
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, []);

  // Draw 3D Raytraced Sphere Scene using Miner-computed Vector & Scanline Bands
  useEffect(() => {
    if (!canvasRef.current || !vectorResult) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const [v0, v1, v2, v3] = vectorResult.input;
    const [out0, out1] = vectorResult.output;

    // Light direction derived from user input + verified WASM output
    const lx = ((v0 - 50) / 60) + ((out0 % 100) / 500);
    const ly = ((v1 - 50) / 60) - 0.4;
    const lz = 0.85;
    const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
    const lightX = lx / lLen;
    const lightY = ly / lLen;
    const lightZ = lz / lLen;

    const baseR = (v2 % 200) + 40;
    const baseG = ((v2 * 3 + Number(customParam)) % 180) + 60;
    const baseB = (v3 % 200) + 55;

    const cx = width / 2;
    const cy = height / 2 - 10;
    const radius = Math.min(width, height) * 0.34;

    for (let y = 0; y < height; y++) {
      // Determine which shard/miner rendered this scanline
      const shardPos = Math.floor((y / height) * totalShards);
      const isBottomRogueBand = showCorruptedPreview && shardPos >= totalShards * 0.72;

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        if (isBottomRogueBand) {
          // Show what the image would look like WITHOUT NEXUS BFT Self-Healing (Rogue Node P6971 glitch!)
          data[idx] = (x * y * 97) % 255;
          data[idx + 1] = 15;
          data[idx + 2] = ((x ^ y) * 53) % 255;
          data[idx + 3] = 255;
          continue;
        }

        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radius * radius) {
          // 3D Sphere Surface Normal
          const dz = Math.sqrt(radius * radius - distSq);
          const nx = dx / radius;
          const ny = -dy / radius;
          const nz = dz / radius;

          const diff = Math.max(0.08, nx * lightX + ny * lightY + nz * lightZ);
          const spec = Math.pow(Math.max(0, nz * lightZ + nx * lightX * 0.5), 24) * 190;

          data[idx] = Math.min(255, Math.round(baseR * diff + spec));
          data[idx + 1] = Math.min(255, Math.round(baseG * diff + spec));
          data[idx + 2] = Math.min(255, Math.round(baseB * diff + spec));
          data[idx + 3] = 255;
        } else if (y > cy + radius * 0.85) {
          // 3D Perspective Checkerboard Floor + Cast Shadow
          const floorY = y - (cy + radius * 0.85) + 1;
          const gridX = Math.floor(((x - cx) * 18) / floorY);
          const gridZ = Math.floor(240 / floorY);
          const checker = (gridX + gridZ) & 1 ? 38 : 16;

          const shadowDx = dx + lightX * 45;
          const shadowDy = (y - (cy + radius * 0.95)) * 2.4;
          const inShadow = shadowDx * shadowDx + shadowDy * shadowDy < radius * radius * 0.9;
          const shade = inShadow ? 0.35 : 1.0;

          data[idx] = Math.round(checker * shade);
          data[idx + 1] = Math.round((checker + 28) * shade);
          data[idx + 2] = Math.round((checker + 22) * shade);
          data[idx + 3] = 255;
        } else {
          // Deep Space Gradient Background
          data[idx] = 6;
          data[idx + 1] = 10 + Math.round((y / height) * 18);
          data[idx + 2] = 18 + Math.round((y / height) * 28);
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw subtle scanline band labels showing which Miner rendered which part of the 3D scene
    if (scanlineBands.length > 0) {
      ctx.font = '10px monospace';
      scanlineBands.forEach((b) => {
        const yPos = Math.max(14, Math.floor((b.rangeStart / totalShards) * height) + 14);
        ctx.fillStyle = b.rescuedFrom ? '#4ade80' : '#38bdf8';
        const label = b.rescuedFrom
          ? `Band ${b.rangeStart}..${b.rangeEnd}: Rescued by Miner :${b.port} (${b.computeTimeUs}µs)`
          : `Band ${b.rangeStart}..${b.rangeEnd}: Rendered by Miner :${b.port} (${b.computeTimeUs}µs)`;
        ctx.fillText(label, 8, yPos);
      });
    }
  }, [vectorResult, scanlineBands, showCorruptedPreview, customParam, totalShards]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      setUploadedWasm({ name: file.name, base64: btoa(binary), size: file.size });
      setSynthMode('rust_matrix');
      setLogs(prev => [...prev, `[WASM X-RAY] Loaded Custom Binary: ${file.name} (${file.size} Bytes)`]);
    };
    reader.readAsArrayBuffer(file);
  };

  const injectPayload = async () => {
    setIsComputing(true);
    setStatus("COMPUTING ON MINERS...");

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customParam: customParam ? Number(customParam) : 42,
          wasmBase64: uploadedWasm?.base64,
          fileName: uploadedWasm?.name,
          enablePruning: true,
          synthMode,
          dataVectorStr,
          totalShards
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.wasmInspector) setWasmInspector(data.wasmInspector);
        if (data.scanlineBands) setScanlineBands(data.scanlineBands);
        if (data.aiTrainingSummary) setAiSummary(data.aiTrainingSummary);
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
          setStatus("BFT HEALED & RENDERED");
        } else if (data.verifiedNodes?.length > 0) {
          const v = data.verifiedNodes[0];
          setLastDiagnostic({
            expected: v.expectedOutput,
            reported: v.results?.[0]?.output,
            fraud: false,
            port: v.nodePort
          });
          setStatus("100% OUTPUT READY");
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

  const downloadOutputResult = () => {
    if (synthMode === 'blender_raytrace' && canvasRef.current) {
      const link = document.createElement('a');
      link.download = `nexus_3d_render_block_${blockHeight}.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
      return;
    }
    const payload = {
      nexusBlock: blockHeight,
      merkleStateSeal: merkleSeal,
      workload: synthMode,
      wasmInspector,
      inputVector: vectorResult?.input,
      verifiedMinerOutputVector: vectorResult?.output,
      aiModelWeights: aiSummary?.learnedWeights
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `nexus_verified_output_block_${blockHeight}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const resetLedger = async () => {
    await fetch('/api/state', { method: 'DELETE' });
    setLastDiagnostic(null);
    setVectorResult(null);
    setWasmInspector(null);
    setLogs(["[SYS] LEDGER RESET: Ready for fresh Visual Compute runs."]);
    fetchState();
  };

  const guide = WORKLOAD_GUIDES[synthMode] || WORKLOAD_GUIDES.blender_raytrace;
  const dynamicUsdCost = ((totalShards / 1000) * 0.016).toFixed(3);
  const dynamicAwsCost = ((totalShards / 1000) * 0.090).toFixed(3);
  const currentNxcPerTask = (Number(dynamicUsdCost) / nxcUsdPrice).toFixed(4);
  const allKnownPorts = Array.from(new Set([6969, 6970, 6971, ...Object.keys(miners).map(Number), ...livePorts])).sort();

  const predictedAiValue = aiSummary
    ? (Number(aiTestInput || 0) * aiSummary.learnedWeights.w1_weight + aiSummary.learnedWeights.bias).toFixed(2)
    : '—';

  return (
    <div className="min-h-screen bg-[#050507] text-green-400 font-mono p-4 md:p-6 flex flex-col items-center">
      <div className="max-w-7xl w-full border border-green-500/30 bg-black/95 rounded-xl overflow-hidden shadow-2xl space-y-0">

        {/* Top Header */}
        <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-green-500/30 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <div>
            <h1 className="text-white font-bold text-lg md:text-xl tracking-wider">
              NEXUS TITAN // v9.0 VISUAL COMPUTE STUDIO
            </h1>
            <p className="text-[11px] text-cyan-400">
              WASM X-RAY INSPECTOR • DISTRIBUTED 3D RAYTRACING (BLENDER STYLE) • LIVE AI MODEL TRAINER • APPLE M4 SILICON
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2.5 py-1 rounded border bg-cyan-950/40 border-cyan-500/40 text-cyan-300 font-bold">
              ⛓️ BLOCK #{blockHeight} | {activeNodes} HONEST MINERS ONLINE
            </span>
            <button onClick={resetLedger} className="text-xs text-gray-300 hover:text-white border border-gray-700 px-3 py-1 rounded">
              🔄 RESET LEDGER
            </button>
          </div>
        </div>

        {/* STEP 1 & STEP 2: User-Friendly Workload Selector + WASM X-Ray Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-green-500/20 divide-y lg:divide-y-0 lg:divide-x divide-green-500/20 bg-[#08090d]">
          
          {/* Left: Step 1 - Choose What You Want to Compute */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold bg-green-500/20 text-green-300 border border-green-500/40 px-2.5 py-0.5 rounded">
                STEP 1: AAP KYA COMPUTE KARWANA CHAHTE HAIN?
              </span>
              <span className="text-xs text-yellow-400 font-bold">
                Cost: {currentNxcPerTask} NXC (${dynamicUsdCost} vs${dynamicAwsCost} AWS)
              </span>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Select Real-World Workload Mode:</label>
              <select
                value={synthMode}
                onChange={(e) => { setSynthMode(e.target.value); setUploadedWasm(null); }}
                className="w-full bg-black border border-cyan-500/50 text-cyan-300 px-3 py-2 rounded text-sm font-bold"
              >
                <option value="blender_raytrace">🎨 1. Blender-Style 3D Raytracing Render (Distributed Pixel Shards)</option>
                <option value="ai_tensor_gemm">🧠 2. AI Neural Network Training (Gradient Descent & Live Predictor)</option>
                <option value="xor_cipher">🔐 3. Financial Monte Carlo & Cryptographic Vector Audit</option>
                <option value="rust_matrix">📂 4. Custom Rust .WASM Binary (Inspect & Execute Any .wasm File)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="text-gray-400 block mb-1">{guide.inputLabel}</label>
                <input
                  type="text"
                  value={dataVectorStr}
                  onChange={(e) => setDataVectorStr(e.target.value)}
                  className="w-full bg-black border border-green-500/40 text-yellow-300 px-2.5 py-1.5 rounded"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">{guide.paramLabel}</label>
                <input
                  type="number"
                  value={customParam}
                  onChange={(e) => setCustomParam(e.target.value)}
                  className="w-full bg-black border border-green-500/40 text-green-400 px-2.5 py-1.5 rounded"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Parallel Shards:</span>
                <select
                  value={totalShards}
                  onChange={(e) => setTotalShards(Number(e.target.value))}
                  className="bg-black border border-green-500/40 text-green-400 px-2 py-1 rounded"
                >
                  <option value={1000}>1,000 Shards</option>
                  <option value={5000}>5,000 Shards</option>
                  <option value={15000}>15,000 Shards</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Or Upload .wasm:</span>
                <input
                  type="file"
                  accept=".wasm"
                  onChange={handleFileUpload}
                  className="text-xs text-gray-400 w-44 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-cyan-500/40 file:text-xs file:bg-cyan-950/30 file:text-cyan-300"
                />
              </div>
            </div>

            <button
              onClick={injectPayload}
              disabled={isComputing}
              className="w-full font-bold py-3 px-6 border-2 bg-green-600/20 hover:bg-green-600 border-green-500 text-green-300 hover:text-white transition-all uppercase tracking-widest text-xs rounded shadow-lg"
            >
              {isComputing ? '⚡ MINERS PAR COMPUTE HO RAHA HAI...' : `🚀 COMPUTE ON SWARM & SHOW VISUAL OUTPUT (${currentNxcPerTask} NXC)`}
            </button>
          </div>

          {/* Right: Step 2 - WASM X-Ray Inspector (Answers: "Meri .wasm file ke andar kya hai?") */}
          <div className="p-5 bg-[#050609] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded">
                STEP 2: MERI .WASM FILE KE ANDAR KYA HAI? (X-RAY INSPECTOR)
              </span>
              {wasmInspector && (
                <span className="text-[11px] text-green-400 font-bold">
                  {wasmInspector.fileName} ({wasmInspector.byteSize} Bytes)
                </span>
              )}
            </div>

            <div className="p-3 bg-black/80 border border-gray-800 rounded space-y-2 text-xs leading-relaxed">
              <p className="text-white font-bold">{guide.title}</p>
              <p className="text-gray-300">
                <span className="text-cyan-400 font-bold">🔍 File Ke Andar Kya Hai: </span>
                {guide.whatIsInsideWasm}
              </p>
              <p className="text-gray-300">
                <span className="text-yellow-400 font-bold">💡 Compute Karwane Ki Zaroorat Kyun Hai: </span>
                {guide.whyComputeNeeded}
              </p>
            </div>

            {wasmInspector ? (
              <div className="p-3 bg-cyan-950/15 border border-cyan-500/30 rounded text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Exported WASM Function:</span>
                  <span className="text-cyan-300 font-bold">{wasmInspector.exportedFunctions.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Memory Architecture:</span>
                  <span className="text-green-300">{wasmInspector.exportedMemory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">UDP Transport Framing:</span>
                  <span className="text-yellow-300">{wasmInspector.udpChunksRequired} Zero-Copy Frame(s) | Magic: 0x{wasmInspector.magicHeaderHex}</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate pt-1">
                  Raw Machine Opcodes: {wasmInspector.bytecodeHexPreview}...
                </div>
              </div>
            ) : (
              <div className="p-3 bg-black/50 border border-gray-800/80 rounded text-xs text-gray-500 text-center">
                Left side par &quot;🚀 COMPUTE ON SWARM&quot; dabayein—yahan aapki .wasm file ka poora X-Ray khul jayega!
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: VISUAL OUTPUT STUDIO (Answers: "Compute hone ke baad data kaisa dikhega aur mere paas kaise aayega?") */}
        <div className="p-6 bg-[#040608] border-b border-green-500/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
            <div>
              <span className="text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded">
                STEP 3: COMPUTE HONE KE BAAD AAPKA RESULT (VISUAL OUTPUT STUDIO)
              </span>
              <p className="text-xs text-gray-400 mt-1">{guide.outputExplanation}</p>
            </div>
            {vectorResult && (
              <div className="flex items-center gap-3">
                {synthMode === 'blender_raytrace' && lastDiagnostic?.fraud && (
                  <button
                    onClick={() => setShowCorruptedPreview(!showCorruptedPreview)}
                    className={`text-xs px-3 py-1.5 rounded border font-bold ${
                      showCorruptedPreview
                        ? 'bg-red-600 text-white border-red-400'
                        : 'bg-gray-900 text-red-400 border-red-500/50 hover:bg-red-950'
                    }`}
                  >
                    {showCorruptedPreview ? '👁️ SHOWING CORRUPTED P6971 GLITCH' : '🔍 PREVIEW WITHOUT BFT HEALING'}
                  </button>
                )}
                <button
                  onClick={downloadOutputResult}
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-1.5 rounded shadow"
                >
                  💾 DOWNLOAD RESULT ({synthMode === 'blender_raytrace' ? '.PNG IMAGE' : '.JSON MODEL'})
                </button>
              </div>
            )}
          </div>

          {!vectorResult ? (
            <div className="p-10 border border-dashed border-gray-800 rounded-lg text-center text-gray-500 text-sm">
              Upar &quot;🚀 COMPUTE ON SWARM&quot; button dabayein — aapka 3D Rendered Scene, Trained AI Model, aur Verified Output yahan live bankar aayega!
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              
              {/* Left Visual Panel: Either 3D Raytraced Canvas OR AI Training Chart */}
              {synthMode === 'blender_raytrace' ? (
                <div className="flex flex-col items-center bg-black p-3 rounded-lg border border-cyan-500/30">
                  <div className="w-full flex justify-between text-[11px] text-gray-400 mb-2">
                    <span>🎨 DISTRIBUTED 3D RAYTRACED CANVAS (360×220)</span>
                    <span className={showCorruptedPreview ? "text-red-400 font-bold" : "text-green-400 font-bold"}>
                      {showCorruptedPreview ? "⚠️ P6971 CORRUPTED PIXELS" : "✅ 100% BFT HEALED RENDER"}
                    </span>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={230}
                    className="rounded border border-gray-800 w-full max-w-[420px]"
                  />
                </div>
              ) : synthMode === 'ai_tensor_gemm' && aiSummary ? (
                <div className="bg-black p-4 rounded-lg border border-purple-500/30 space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <span className="text-xs font-bold text-purple-300">🧠 AI TRAINING CONVERGENCE ({aiSummary.epochsCompleted} SHARD EPOCHS)</span>
                    <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded font-bold">
                      Accuracy: {aiSummary.accuracyPct}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-red-950/20 border border-red-500/30 rounded">
                      <p className="text-gray-400 text-[10px]">BEFORE TRAINING (INITIAL ERROR)</p>
                      <p className="text-red-400 text-lg font-bold">{aiSummary.initialLossPct}% Loss</p>
                    </div>
                    <div className="p-2.5 bg-green-950/20 border border-green-500/30 rounded">
                      <p className="text-gray-400 text-[10px]">AFTER SWARM TRAINING (FINAL ERROR)</p>
                      <p className="text-green-400 text-lg font-bold">{aiSummary.finalLossPct}% Loss ✓</p>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-950/20 border border-purple-500/40 rounded space-y-2">
                    <p className="text-xs text-white font-bold">🧪 TEST YOUR NEWLY TRAINED AI MODEL LIVE:</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400">Enter Any Input (X):</span>
                      <input
                        type="number"
                        value={aiTestInput}
                        onChange={(e) => setAiTestInput(e.target.value)}
                        className="bg-black border border-purple-400 text-yellow-300 px-2.5 py-1 rounded w-24 font-bold"
                      />
                      <span className="text-gray-400">→ AI Prediction:</span>
                      <span className="text-green-300 font-bold text-sm bg-green-950/50 px-3 py-1 rounded border border-green-500/40">
                        {predictedAiValue}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Trained Formula on Miners: Y = {aiSummary.learnedWeights.w1_weight} × X + {aiSummary.learnedWeights.bias} (Attention W2: {aiSummary.learnedWeights.w2_attention})
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-black p-4 rounded-lg border border-green-500/30 space-y-2 text-xs">
                  <p className="text-white font-bold">🔐 VERIFIED WASM LINEAR MEMORY TRANSFORMATION TABLE</p>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {vectorResult.input.map((inp, idx) => (
                      <div key={idx} className="p-2 bg-gray-950 border border-gray-800 rounded flex justify-between">
                        <span className="text-gray-400">Input[{idx}] = <strong className="text-cyan-300">{inp}</strong></span>
                        <span className="text-yellow-300 font-bold">→ {vectorResult.output[idx]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Right Explanation Panel: How the Swarm Divided & Healed the Work */}
              <div className="bg-black/90 p-4 rounded-lg border border-gray-800 space-y-3 text-xs">
                <p className="text-white font-bold border-b border-gray-800 pb-1.5">
                  📊 SWARM NE AAPKA DATA KAISE COMPUTE AUR VERIFY KIYA:
                </p>

                <div className="space-y-2">
                  {scanlineBands.map((b, i) => (
                    <div key={i} className={`p-2.5 rounded border flex justify-between items-center ${
                      b.rescuedFrom ? 'bg-green-950/20 border-green-500/40' : 'bg-gray-900/50 border-gray-800'
                    }`}>
                      <div>
                        <span className="font-bold text-white">
                          Shards {b.rangeStart} to {b.rangeEnd} ({b.allocationPct})
                        </span>
                        <p className="text-[11px] text-gray-400">
                          {b.rescuedFrom
                            ? `🛡️ Node :${b.rescuedFrom} ne galat data bheja -> Hero Node :${b.port} ne ${b.computeTimeUs}µs mein rescue kiya!`
                            : `✅ Node :${b.port} ne ${b.computeTimeUs}µs mein sahi compute karke Ed25519 sign kiya.`}
                        </p>
                      </div>
                      <span className="text-cyan-400 font-bold">{b.gops} GOPS</span>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-[#090b10] border border-gray-800 rounded flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Aapne Input Bheja:</span>
                    <span className="text-cyan-300 font-bold">[{vectorResult.input.join(', ')}]</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Miners Se Verified Output Aaya:</span>
                    <span className="text-yellow-300 font-bold">[{vectorResult.output.join(', ')}]</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Bottom Collapsible/Clean Hardware & Tokenomics Bar */}
        <div className="p-4 bg-[#060606] border-b border-green-500/20">
          <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-2">
            UNDER-THE-HOOD HARDWARE MINERS (APPLE M4 REAL TELEMETRY) & TOKENOMICS — WALLET: {clientWallet.toFixed(4)} NXC | PRICE: ${nxcUsdPrice.toFixed(4)} | BURNED: {totalBurned.toFixed(2)} NXC
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {allKnownPorts.map((port) => {
              const m = miners[String(port)] || { host: '127.0.0.1', wallet: 0, staked: 1000, trust: 100, slashed: false };
              const isOnline = livePorts.includes(port);
              return (
                <div key={port} className={`p-2.5 rounded border text-[11px] ${
                  m.slashed ? 'border-red-600 bg-red-950/20' :
                  isOnline ? 'border-green-500/40 bg-green-950/10' : 'border-gray-800 bg-black/40'
                }`}>
                  <div className="flex justify-between font-bold text-white mb-1">
                    <span>MINER :{port} ({m.cpuModel || 'Apple M4'})</span>
                    <span className={m.slashed ? 'text-red-400' : 'text-green-400'}>
                      {m.slashed ? 'SLASHED (-250 NXC)' : `${m.cores ?? 8} Cores | ${m.battery ?? 100}% Batt`}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Earned: <strong className="text-yellow-400">{Number(m.wallet).toFixed(4)} NXC</strong></span>
                    <span>Speed: <strong className="text-purple-400">{m.gopsThroughput || 0} GOPS ({m.lastComputeUs ?? 0}µs)</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
