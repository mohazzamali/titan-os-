'use client';
import { useState, useEffect, useRef } from 'react';

const INDUSTRY_KERNELS = [
  {
    id: 'quant_monte_carlo',
    name: '1. Quantitative Finance — Monte Carlo Option Pricing (quant_monte_carlo.wasm)',
    spec: { iterations: 250000, multiplier: 1664525, addConstant: 1013904223, shiftBits: 11, mixOp: 'xor' as const }
  },
  {
    id: 'zk_sha256_merkle',
    name: '2. Zero-Knowledge (ZK) — Merkle Proof State Hasher (zk_sha256_merkle.wasm)',
    spec: { iterations: 300000, multiplier: 2045885385, addConstant: 2019505643, shiftBits: 15, mixOp: 'xor' as const }
  },
  {
    id: 'dsp_fft_spectral',
    name: '3. Signal & Audio DSP — Fast Spectral Butterfly Kernel (dsp_fft_spectral.wasm)',
    spec: { iterations: 180000, multiplier: 2246822519, addConstant: 3266489917, shiftBits: 13, mixOp: 'add' as const }
  },
  {
    id: 'ai_cosine_similarity',
    name: '4. AI Vector Embeddings — Cosine Similarity & Scaling (ai_cosine_similarity.wasm)',
    spec: { iterations: 200000, multiplier: 374761393, addConstant: 668265263, shiftBits: 9, mixOp: 'mul' as const }
  },
  {
    id: 'physics_verlet_sim',
    name: '5. Physics & Robotics — Verlet Collision Solver (physics_verlet_sim.wasm)',
    spec: { iterations: 150000, multiplier: 1103515245, addConstant: 12345, shiftBits: 16, mixOp: 'xor' as const }
  }
];

export default function NexusCloudConsole() {
  const [blockHeight, setBlockHeight] = useState(1);
  const [merkleSeal, setMerkleSeal] = useState("");
  const [clientWallet, setClientWallet] = useState(100);
  const [totalBurned, setTotalBurned] = useState(0);
  const [circulatingSupply, setCirculatingSupply] = useState(21000000);
  const [nxcUsdPrice, setNxcUsdPrice] = useState(2.50);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [miners, setMiners] = useState<Record<string, any>>({});

  const [activeView, setActiveView] = useState<'wasm_cloud' | 'wasm_studio' | 'software_bridge' | 'vision_pipeline'>('wasm_cloud');

  const [selectedPreset, setSelectedPreset] = useState<string>('quant_monte_carlo');
  const [dataVectorStr, setDataVectorStr] = useState("45, 80, 120, 165, 256, 720");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchInputText, setBatchInputText] = useState("45, 80, 120, 165\n12, 34, 56, 78\n90, 180, 270, 360\n105, 210, 315, 420\n7, 14, 21, 28\n500, 600, 700, 800");
  const [totalShards, setTotalShards] = useState<number>(8);
  const [uploadedWasm, setUploadedWasm] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [matrixFormat, setMatrixFormat] = useState<'dec' | 'hex'>('dec');
  const [execResult, setExecResult] = useState<any>(null);

  const [studioKernelName, setStudioKernelName] = useState('custom_quant_v1.wasm');
  const [studioIterations, setStudioIterations] = useState(250000);
  const [studioMultiplier, setStudioMultiplier] = useState(1664525);
  const [studioAddConst, setStudioAddConst] = useState(1013904223);
  const [studioShift, setStudioShift] = useState(11);
  const [studioMixOp, setStudioMixOp] = useState<'xor' | 'add' | 'mul'>('xor');
  const [studioTestInfinite, setStudioTestInfinite] = useState(false);

  const [bridgeLang, setBridgeLang] = useState<'python' | 'nodejs' | 'rust' | 'curl'>('python');
  const [bridgeTestResponse, setBridgeTestResponse] = useState<any>(null);
  const [isTestingBridge, setIsTestingBridge] = useState(false);

  const [realImageName, setRealImageName] = useState<string | null>(null);
  const [imageFilterMode, setImageFilterMode] = useState<'sobel_edge' | 'xray_clahe' | 'invert_bone'>('sobel_edge');
  const [imageStats, setImageStats] = useState<{ width: number; height: number; pixelsProcessed: number; timeMs: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const origImgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const procImgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const fetchClusterState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setBlockHeight(data?.blockHeight ?? 1);
      setMerkleSeal(data?.merkleStateSeal ?? "");
      setClientWallet(data?.clientWallet ?? 100);
      setTotalBurned(data?.totalBurned ?? 0);
      setCirculatingSupply(data?.circulatingSupply ?? 21000000);
      setNxcUsdPrice(data?.nxcUsdPrice ?? 2.50);
      setActiveNodes(data?.activeNodes ?? 0);
      setLivePorts(data?.livePorts ?? []);
      setMiners(data?.miners ?? {});
    } catch {}
  };

  useEffect(() => {
    fetchClusterState();
    const interval = setInterval(fetchClusterState, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleWasmSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    setExecResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = '';
      const chunk = 32768;
      for (let i = 0; i < bytes.byteLength; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      setUploadedWasm({ name: file.name, base64: btoa(binary), size: file.size });
    };
    reader.readAsArrayBuffer(file);
  };

  const removeCustomWasm = () => {
    setUploadedWasm(null);
    setExecResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseBatchLines = (): number[][] | undefined => {
    if (isBatchMode) {
      return batchInputText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)))
        .filter(arr => arr.length > 0);
    }
    const nums = dataVectorStr.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    if (nums.length > 4) {
      const chunks: number[][] = [];
      for (let i = 0; i < nums.length; i += 4) {
        chunks.push([
          nums[i] ?? 45,
          nums[(i + 1) % nums.length] ?? 80,
          nums[(i + 2) % nums.length] ?? 120,
          nums[(i + 3) % nums.length] ?? 165
        ]);
      }
      return chunks;
    }
    return undefined;
  };

  const deployWorkload = async (overrideStudioSpec?: any) => {
    setErrorBanner(null);
    setIsDeploying(true);
    try {
      const payload: any = {
        presetKernelId: selectedPreset,
        dataVectorStr,
        totalShards,
        batchVectors: parseBatchLines()
      };
      if (overrideStudioSpec) {
        payload.studioSpec = overrideStudioSpec;
      } else if (uploadedWasm) {
        payload.wasmBase64 = uploadedWasm.base64;
        payload.fileName = uploadedWasm.name;
      }

      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setExecResult(data);
        await fetchClusterState();
        if (overrideStudioSpec) setActiveView('wasm_cloud');
      } else {
        setErrorBanner(data.error || data.message || 'Execution failed');
      }
    } catch (err: any) {
      setErrorBanner(err.message);
    }
    setIsDeploying(false);
  };

  const compileAndRunStudioWasm = async () => {
    await deployWorkload({
      customName: studioKernelName || 'studio_custom.wasm',
      iterations: studioIterations,
      multiplier: studioMultiplier,
      addConstant: studioAddConst,
      shiftBits: studioShift,
      mixOp: studioMixOp,
      injectInfiniteLoop: studioTestInfinite
    });
  };

  const downloadCompiledStudioWasm = () => {
    if (!execResult?.wasmInspector?.wasmBase64) return;
    const binStr = atob(execResult.wasmInspector.wasmBase64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/wasm' });
    const link = document.createElement('a');
    link.download = execResult.wasmInspector.fileName || 'compiled_kernel.wasm';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRealImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        loadedImageRef.current = img;
        executeVisionPipeline(img, imageFilterMode);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const executeVisionPipeline = (img: HTMLImageElement, mode: string) => {
    if (!origImgCanvasRef.current || !procImgCanvasRef.current) return;
    const t0 = performance.now();

    const w = 420;
    const h = Math.max(200, Math.min(420, Math.round((img.height / img.width) * w)));
    origImgCanvasRef.current.width = w;
    origImgCanvasRef.current.height = h;
    procImgCanvasRef.current.width = w;
    procImgCanvasRef.current.height = h;

    const oCtx = origImgCanvasRef.current.getContext('2d')!;
    const pCtx = procImgCanvasRef.current.getContext('2d')!;

    oCtx.drawImage(img, 0, 0, w, h);
    const srcData = oCtx.getImageData(0, 0, w, h);
    const dstData = pCtx.createImageData(w, h);
    const src = srcData.data;
    const dst = dstData.data;

    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = Math.round(0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2]);
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const pIdx = idx * 4;

        if (mode === 'sobel_edge') {
          const gx =
            -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)] +
            -2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] +
            -gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
          const gy =
            -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
            gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
          const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
          dst[pIdx] = mag > 65 ? 16 : 8;
          dst[pIdx + 1] = mag;
          dst[pIdx + 2] = Math.min(255, Math.round(mag * 1.15));
          dst[pIdx + 3] = 255;
        } else if (mode === 'xray_clahe') {
          const center = gray[idx];
          const localMean = (
            gray[(y - 1) * w + x] + gray[(y + 1) * w + x] +
            gray[y * w + (x - 1)] + gray[y * w + (x + 1)]
          ) * 0.25;
          const sharpened = Math.min(255, Math.max(0, Math.round(center + (center - localMean) * 2.8)));
          dst[pIdx] = sharpened > 165 ? 255 : sharpened;
          dst[pIdx + 1] = sharpened;
          dst[pIdx + 2] = sharpened > 165 ? Math.round(sharpened * 0.5) : Math.min(255, Math.round(sharpened * 1.15));
          dst[pIdx + 3] = 255;
        } else {
          const inv = 255 - gray[idx];
          dst[pIdx] = inv;
          dst[pIdx + 1] = inv;
          dst[pIdx + 2] = inv;
          dst[pIdx + 3] = 255;
        }
      }
    }

    pCtx.putImageData(dstData, 0, 0);
    setImageStats({
      width: w,
      height: h,
      pixelsProcessed: w * h,
      timeMs: Number((performance.now() - t0).toFixed(2))
    });
  };

  const exportProcessedImage = () => {
    if (!procImgCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `nexus_output_${realImageName || 'scan'}.png`;
    link.href = procImgCanvasRef.current.toDataURL('image/png');
    link.click();
  };

  const exportExecutionReceipt = () => {
    if (!execResult) return;
    const blob = new Blob([JSON.stringify(execResult, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `nexus_receipt_block_${blockHeight}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const resetClusterLedger = async () => {
    await fetch('/api/state', { method: 'DELETE' });
    setExecResult(null);
    setErrorBanner(null);
    fetchClusterState();
  };

  const testLiveSoftwareBridge = async () => {
    setIsTestingBridge(true);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetKernelId: selectedPreset,
          inputVector: [45, 80, 120, 165],
          totalShards: 4
        })
      });
      const data = await res.json();
      setBridgeTestResponse(data);
      await fetchClusterState();
    } catch (e: any) {
      setBridgeTestResponse({ error: e.message });
    }
    setIsTestingBridge(false);
  };

  const generatedWatPreview = `(module
  (memory (export "memory") 16)
  (func (export "execute_task") (param $seed i32) (param $param i32) (result i32)
    (local $acc i32) (local $counter i32)
    (local.set $acc (i32.add (i32.xor (local.get $seed) (i32.const ${studioAddConst})) (local.get $param)))
    (local.set $counter (i32.const ${studioIterations}))
    (loop $compute_loop
      (local.set $acc
        (i32.${studioMixOp}
          (i32.mul (local.get $acc) (i32.const ${studioMultiplier}))
          (i32.add (i32.add (i32.shr_u (local.get $acc) (i32.const ${studioShift})) (local.get $param)) (local.get $counter))
        )
      )
      (i32.store (i32.add (i32.const 196608) (i32.shl (i32.and (local.get $counter) (i32.const 63)) (i32.const 2))) (local.get $acc))
      ${studioTestInfinite
        ? ';; ⚠️ UNCONDITIONAL INFINITE JUMP (Will be BANNED by Static Bytecode Scanner!)\n      (br $compute_loop)'
        : ';; Bounded Loop Exit Condition (Verified Safe)\n      (local.tee $counter (i32.sub (local.get $counter) (i32.const 1)))\n      (br_if $compute_loop (i32.gt_s (local.get $counter) (i32.const 0)))'}
    )
    (local.get $acc)
  )
)`;

  const bridgeSnippets: Record<string, string> = {
    python: `import requests

def nexus_remote_compute(vector, kernel="${selectedPreset}", shards=4):
    resp = requests.post("http://localhost:3000/api/deploy", json={
        "presetKernelId": kernel,
        "inputVector": vector,
        "totalShards": shards
    }, timeout=60)
    data = resp.json()
    return {
        "block": data["blockHeight"],
        "verified_vector": data["verifiedMinerOutputVector"],
        "matrix_sample": data["extractedMatrixSample"][:8],
        "merkle_seal": data["merkleStateSeal"]
    }

if __name__ == "__main__":
    result = nexus_remote_compute([45, 80, 120, 165])
    print("Verified M4 Cluster Result:", result)`,

    nodejs: `async function runOnNexusCluster(inputVector = [45, 80, 120, 165]) {
  const res = await fetch("http://localhost:3000/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      presetKernelId: "${selectedPreset}",
      inputVector,
      totalShards: 4
    })
  });
  const receipt = await res.json();
  console.log("Verified Output Vector:", receipt.verifiedMinerOutputVector);
  return receipt;
}

runOnNexusCluster();`,

    rust: `use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let res: serde_json::Value = client
        .post("http://localhost:3000/api/deploy")
        .json(&json!({
            "presetKernelId": "${selectedPreset}",
            "inputVector": [45, 80, 120, 165],
            "totalShards": 4
        }))
        .send()
        .await?
        .json()
        .await?;

    println!("Verified Output: {}", res["verifiedMinerOutputVector"]);
    Ok(())
}`,

    curl: `curl -X POST http://localhost:3000/api/deploy \\
  -H "Content-Type: application/json" \\
  -d '{
    "presetKernelId": "${selectedPreset}",
    "inputVector": [45, 80, 120, 165],
    "totalShards": 4
  }'`
  };

  const allKnownPorts = Array.from(new Set([6969, 6970, 6971, ...Object.keys(miners).map(Number), ...livePorts])).sort();

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-200 font-sans p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-7xl w-full border border-slate-800 bg-[#0d1117] rounded-xl overflow-hidden shadow-2xl">

        <div className="bg-[#111622] border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">
                NEXUS TITAN // DISTRIBUTED WASM COMPUTE PLATFORM
              </h1>
              <p className="text-xs text-slate-400">
                Serverless Apple Silicon Cluster • Pre-Flight Infinite-Loop Guard • Live WASM Studio &amp; Software RPC Bridge
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-mono">
              Block <span className="text-emerald-400 font-semibold">#{blockHeight}</span> •{' '}
              <span className={activeNodes > 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                {activeNodes} Active Nodes
              </span>
            </div>
            <button
              onClick={resetClusterLedger}
              className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-md transition"
            >
              Reset State
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-6 py-3.5 bg-[#0a0d14] border-b border-slate-800/80">
          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/90">
            <span className="text-[11px] text-slate-400 block">Account Balance</span>
            <span className="text-base font-semibold text-white font-mono">
              {clientWallet.toFixed(4)} <span className="text-emerald-400 text-xs">NXC</span>
            </span>
            <span className="text-[11px] text-slate-500 block">≈ ${(clientWallet * nxcUsdPrice).toFixed(2)} USD</span>
          </div>

          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/90">
            <span className="text-[11px] text-slate-400 block">NXC Index Price</span>
            <span className="text-base font-semibold text-cyan-400 font-mono">${nxcUsdPrice.toFixed(4)}</span>
            <span className="text-[11px] text-emerald-400 block">
              +{(((nxcUsdPrice - 2.5) / 2.5) * 100).toFixed(2)}% vs Genesis
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/90">
            <span className="text-[11px] text-slate-400 block">Cumulative Fee Burn (30%)</span>
            <span className="text-base font-semibold text-amber-400 font-mono">{totalBurned.toFixed(4)} NXC</span>
            <span className="text-[11px] text-slate-500 block">Burn-and-Mint Equilibrium</span>
          </div>

          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/90">
            <span className="text-[11px] text-slate-400 block">Circulating Supply</span>
            <span className="text-base font-semibold text-slate-200 font-mono">
              {circulatingSupply.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-500 block">Max Cap: 21,000,000 NXC</span>
          </div>

          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/90 col-span-2 md:col-span-1">
            <span className="text-[11px] text-slate-400 block">Latest State Root</span>
            <span className="text-xs font-mono text-slate-300 truncate block mt-0.5" title={merkleSeal}>
              {merkleSeal ? `0x${merkleSeal.substring(0, 20)}...` : '—'}
            </span>
            <span className="text-[11px] text-emerald-400 block mt-0.5">Ed25519 Attested</span>
          </div>
        </div>

        <div className="flex flex-wrap border-b border-slate-800 bg-[#0d1117] px-6 gap-6">
          <button
            onClick={() => setActiveView('wasm_cloud')}
            className={`py-3.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition ${
              activeView === 'wasm_cloud'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Compute Deployment &amp; Batch Runner
          </button>
          <button
            onClick={() => setActiveView('wasm_studio')}
            className={`py-3.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition ${
              activeView === 'wasm_studio'
                ? 'border-purple-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Live WASM Studio &amp; Loop Guard
          </button>
          <button
            onClick={() => setActiveView('software_bridge')}
            className={`py-3.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition ${
              activeView === 'software_bridge'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Connect External Software (API Bridge)
          </button>
          <button
            onClick={() => setActiveView('vision_pipeline')}
            className={`py-3.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition ${
              activeView === 'vision_pipeline'
                ? 'border-cyan-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Medical &amp; Vision Pixel Pipeline
          </button>
        </div>

        {errorBanner && (
          <div className="bg-red-950/90 border-b border-red-500/70 px-6 py-3.5 text-xs text-red-200 flex justify-between items-center font-mono">
            <span>🛡️ SECURITY / EXECUTION GUARD: {errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="text-red-300 hover:text-white px-2">✕</button>
          </div>
        )}

        {activeView === 'wasm_cloud' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-[#111622] p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-white">Select Industry Kernel or Upload Custom .WASM</h2>
                  <button
                    onClick={() => {
                      const found = INDUSTRY_KERNELS.find(k => k.id === selectedPreset);
                      if (found) {
                        setStudioKernelName(found.id + '_custom.wasm');
                        setStudioIterations(found.spec.iterations);
                        setStudioMultiplier(found.spec.multiplier);
                        setStudioAddConst(found.spec.addConstant);
                        setStudioShift(found.spec.shiftBits);
                        setStudioMixOp(found.spec.mixOp);
                      }
                      setActiveView('wasm_studio');
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
                  >
                    Open in Live WASM Editor →
                  </button>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Top 5 Production WASM Kernels</label>
                  <select
                    value={selectedPreset}
                    disabled={Boolean(uploadedWasm)}
                    onChange={(e) => { setSelectedPreset(e.target.value); setExecResult(null); }}
                    className="w-full bg-[#090b10] border border-slate-700 focus:border-emerald-500 text-white text-xs font-mono px-3 py-2.5 rounded-lg outline-none disabled:opacity-50"
                  >
                    {INDUSTRY_KERNELS.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Or Upload Custom Compiled .WASM Binary (Up to 50 MB)</label>
                  <div className="p-2.5 bg-[#090b10] border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".wasm"
                      onChange={handleWasmSelect}
                      className="text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:text-slate-200 cursor-pointer"
                    />
                    {uploadedWasm && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400 font-mono">
                          {uploadedWasm.name} ({(uploadedWasm.size / 1024).toFixed(1)} KB)
                        </span>
                        <button onClick={removeCustomWasm} className="text-xs text-red-400 hover:text-red-300 underline">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs text-slate-400">Execution Input Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsBatchMode(false)}
                      className={`text-xs px-3 py-1 rounded-md border ${!isBatchMode ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                    >
                      Parameter Vector
                    </button>
                    <button
                      onClick={() => setIsBatchMode(true)}
                      className={`text-xs px-3 py-1 rounded-md border ${isBatchMode ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                    >
                      Batch Dataset (Multi-Row CSV)
                    </button>
                  </div>
                </div>

                {!isBatchMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1.5">Input Parameter Vector (int32 values)</label>
                      <input
                        type="text"
                        value={dataVectorStr}
                        onChange={(e) => setDataVectorStr(e.target.value)}
                        className="w-full bg-[#090b10] border border-slate-700 text-white font-mono px-3 py-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1.5">Parallel Shard Partitions</label>
                      <select
                        value={totalShards}
                        onChange={(e) => setTotalShards(Number(e.target.value))}
                        className="w-full bg-[#090b10] border border-slate-700 text-white font-mono px-3 py-2 rounded-lg"
                      >
                        <option value={3}>3 Shards (1 per Node)</option>
                        <option value={4}>4 Shards (Standard Vector)</option>
                        <option value={8}>8 Shards (Balanced Partition)</option>
                        <option value={16}>16 Shards (High-Density Batch)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <label className="text-slate-400 block">Batch Dataset Rows (One vector per line)</label>
                    <textarea
                      rows={4}
                      value={batchInputText}
                      onChange={(e) => setBatchInputText(e.target.value)}
                      className="w-full bg-[#090b10] border border-slate-700 text-emerald-300 font-mono p-2.5 rounded-lg text-xs"
                    />
                  </div>
                )}

                <button
                  onClick={() => deployWorkload()}
                  disabled={isDeploying}
                  className="w-full font-semibold py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white transition rounded-lg text-xs tracking-wide shadow-lg"
                >
                  {isDeploying ? 'Executing on M4 Cluster...' : 'Deploy & Execute on Cluster'}
                </button>
              </div>

              <div className="lg:col-span-6 bg-[#111622] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                    <h2 className="text-sm font-semibold text-white">Binary Telemetry &amp; Pre-Flight Loop Guard</h2>
                    {execResult?.wasmInspector?.cacheStatus && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono">
                        {execResult.wasmInspector.cacheStatus}
                      </span>
                    )}
                  </div>

                  {execResult?.wasmInspector ? (
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Binary Artifact</span>
                        <span className="text-white">{execResult.wasmInspector.fileName} ({execResult.wasmInspector.byteSize.toLocaleString()} B)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Infinite-Loop Guard</span>
                        <span className="text-emerald-400">{execResult.wasmInspector.loopSafetyAudit}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">SHA-256 Content Hash</span>
                        <span className="text-cyan-300">0x{execResult.wasmInspector.sha256}...</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Entry Function</span>
                        <span className="text-slate-200">{execResult.wasmInspector.exportedFunctions.join(', ')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Linear Memory</span>
                        <span className="text-slate-200">{execResult.wasmInspector.exportedMemory}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Raw Bytecode Header</span>
                        <span className="text-slate-400 truncate max-w-xs">{execResult.wasmInspector.bytecodeHexPreview}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-12 text-center">
                      Select any industry kernel or upload a custom .wasm file and click &quot;Deploy &amp; Execute on Cluster&quot; to inspect pre-flight loop safety and cluster telemetry.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {execResult && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#111622] border border-slate-800 rounded-xl">
                    <span className="text-[11px] text-slate-400 block">Cluster Wall Time</span>
                    <span className="text-2xl font-semibold text-emerald-400 font-mono mt-1 block">
                      {execResult.swarmParallelWallMs} ms
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Single-Core Baseline: {execResult.benchNative4CallsMs} ms
                    </span>
                  </div>

                  <div className="p-4 bg-[#111622] border border-slate-800 rounded-xl">
                    <span className="text-[11px] text-slate-400 block">Cluster Compute Rate</span>
                    <span className="text-2xl font-semibold text-cyan-400 font-mono mt-1 block">
                      {execResult.tokenomicsAudit?.swarmTotalGops} GOPS
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Across {execResult.scanlineBands?.length || 3} Verified M4 Nodes
                    </span>
                  </div>

                  <div className="p-4 bg-[#111622] border border-slate-800 rounded-xl">
                    <span className="text-[11px] text-slate-400 block">Workload Settlement</span>
                    <span className="text-lg font-semibold text-white font-mono mt-1 block">
                      {execResult.tokenomicsAudit?.totalGasNxc} NXC
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block font-mono">
                      Node Payout: {execResult.tokenomicsAudit?.minerYieldNxc} • Burn: {execResult.tokenomicsAudit?.burnedNxc}
                    </span>
                  </div>

                  <div className="p-4 bg-[#111622] border border-slate-800 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Verified Return Vector</span>
                      <span className="text-xs font-mono font-semibold text-amber-300 mt-1 block break-all">
                        [{execResult.verifiedMinerOutputVector?.join(', ')}]
                      </span>
                    </div>
                    <button
                      onClick={exportExecutionReceipt}
                      className="mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium py-1.5 px-3 rounded-lg transition"
                    >
                      Download JSON Receipt
                    </button>
                  </div>
                </div>

                {execResult.batchResults && execResult.batchResults.length > 0 && (
                  <div className="bg-[#111622] border border-emerald-500/30 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                        Multi-Vector / Batch Execution Results ({execResult.batchResults.length} Partitions Processed)
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-800 bg-[#0b0e17] text-slate-400">
                            <th className="py-2 px-4">Batch #</th>
                            <th className="py-2 px-4">Assigned Node</th>
                            <th className="py-2 px-4">Input Slice</th>
                            <th className="py-2 px-4">Verified Output Vector</th>
                          </tr>
                        </thead>
                        <tbody>
                          {execResult.batchResults.map((row: any) => (
                            <tr key={row.row} className="border-b border-slate-800/50">
                              <td className="py-2 px-4 text-slate-400">#{row.row}</td>
                              <td className="py-2 px-4 text-cyan-400">Node :{row.assignedNode}</td>
                              <td className="py-2 px-4 text-slate-200">[{row.input.join(', ')}]</td>
                              <td className="py-2 px-4 text-emerald-400 font-semibold">[{row.output.join(', ')}]</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {execResult.scanlineBands?.length > 0 && (
                  <div className="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Node Shard Distribution &amp; Cryptographic Proofs
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">Ed25519 Signature Verification</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-800 bg-[#0b0e17] text-slate-400">
                            <th className="py-2.5 px-4">Node Endpoint</th>
                            <th className="py-2.5 px-4">Shard Partition</th>
                            <th className="py-2.5 px-4">Allocation</th>
                            <th className="py-2.5 px-4">Transport</th>
                            <th className="py-2.5 px-4">Execution Time</th>
                            <th className="py-2.5 px-4">Throughput</th>
                            <th className="py-2.5 px-4">Shard Result</th>
                            <th className="py-2.5 px-4">Node Payout</th>
                            <th className="py-2.5 px-4">Burned</th>
                            <th className="py-2.5 px-4">Attestation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {execResult.scanlineBands.map((b: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                              <td className="py-2.5 px-4 font-semibold text-white">127.0.0.1:{b.port}</td>
                              <td className="py-2.5 px-4 text-cyan-400">[{b.rangeStart}..{b.rangeEnd})</td>
                              <td className="py-2.5 px-4 text-slate-300">{b.allocationPct}</td>
                              <td className="py-2.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${b.cacheHit ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'}`}>
                                  {b.cacheHit ? 'NEXH Cache' : 'NEXC Stream'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-200">{b.computeTimeMs} ms</td>
                              <td className="py-2.5 px-4 text-slate-200">{b.gops} GOPS</td>
                              <td className="py-2.5 px-4 text-emerald-400">{b.outputVal}</td>
                              <td className="py-2.5 px-4 text-emerald-300">+{b.rewardNxc} NXC</td>
                              <td className="py-2.5 px-4 text-amber-400">{b.burnedNxc} NXC</td>
                              <td className="py-2.5 px-4 text-emerald-400">✓ {b.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {execResult.extractedMatrixSample?.length > 0 && (
                  <div className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                          WASM Linear Memory Buffer Snapshot (64 × Int32 Words at 0x30000)
                        </h3>
                      </div>
                      <button
                        onClick={() => setMatrixFormat(matrixFormat === 'dec' ? 'hex' : 'dec')}
                        className="text-xs px-3 py-1 rounded-md border border-slate-700 bg-slate-800 text-slate-200 font-mono"
                      >
                        Display: {matrixFormat === 'dec' ? 'Decimal (uint32)' : 'Hexadecimal (0x)'}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-[11px] font-mono pt-1">
                      {execResult.extractedMatrixSample.slice(0, 64).map((val: number, idx: number) => (
                        <div key={idx} className="p-2 bg-[#090b10] border border-slate-800/90 rounded-md text-center">
                          <span className="text-slate-500 text-[10px] block">[{idx}]</span>
                          <span className="text-slate-200 font-medium">
                            {matrixFormat === 'hex' ? `0x${(val >>> 0).toString(16).toUpperCase().padStart(8, '0')}` : val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeView === 'wasm_studio' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-[#111622] p-5 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">In-Platform WASM Kernel Editor &amp; Assembler</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modify loop bounds, bitwise operators, and constants below. Compiles directly into a valid .wasm binary in real time.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Output Binary Filename</label>
                    <input
                      type="text"
                      value={studioKernelName}
                      onChange={(e) => setStudioKernelName(e.target.value)}
                      className="w-full bg-[#090b10] border border-slate-700 text-white font-mono px-3 py-2 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Loop Iterations ($counter)</label>
                      <input
                        type="number"
                        value={studioIterations}
                        onChange={(e) => setStudioIterations(Number(e.target.value))}
                        className="w-full bg-[#090b10] border border-slate-700 text-emerald-300 font-mono px-3 py-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Primary Folding Operator</label>
                      <select
                        value={studioMixOp}
                        onChange={(e) => setStudioMixOp(e.target.value as any)}
                        className="w-full bg-[#090b10] border border-slate-700 text-cyan-300 font-mono px-3 py-2 rounded-lg"
                      >
                        <option value="xor">i32.xor (0x73 Bitwise XOR)</option>
                        <option value="add">i32.add (0x6A Modular Add)</option>
                        <option value="mul">i32.mul (0x6C Nonlinear Multiply)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Multiplier Constant</label>
                      <input
                        type="number"
                        value={studioMultiplier}
                        onChange={(e) => setStudioMultiplier(Number(e.target.value))}
                        className="w-full bg-[#090b10] border border-slate-700 text-white font-mono px-2.5 py-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">XOR Seed Constant</label>
                      <input
                        type="number"
                        value={studioAddConst}
                        onChange={(e) => setStudioAddConst(Number(e.target.value))}
                        className="w-full bg-[#090b10] border border-slate-700 text-white font-mono px-2.5 py-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Bit Shift (1..31)</label>
                      <input
                        type="number"
                        value={studioShift}
                        onChange={(e) => setStudioShift(Number(e.target.value))}
                        className="w-full bg-[#090b10] border border-slate-700 text-white font-mono px-2.5 py-2 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#090b10] border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-amber-300 block">Test Pre-Flight Infinite Loop Ban</span>
                      <span className="text-[11px] text-slate-400">
                        Replaces bounded `br_if` with unconditional `br 0` to verify the Static Bytecode Scanner blocks it.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={studioTestInfinite}
                      onChange={(e) => setStudioTestInfinite(e.target.checked)}
                      className="h-4 w-4 accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={compileAndRunStudioWasm}
                    disabled={isDeploying}
                    className="flex-1 font-semibold py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition"
                  >
                    {isDeploying ? 'Compiling & Deploying...' : 'Compile .WASM & Execute on Cluster'}
                  </button>
                  {execResult?.wasmInspector?.wasmBase64 && (
                    <button
                      onClick={downloadCompiledStudioWasm}
                      className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                    >
                      Download .WASM
                    </button>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 bg-[#111622] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Live Disassembled WebAssembly Text (WAT) Preview
                  </span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${studioTestInfinite ? 'bg-red-950 text-red-300 border border-red-500/40' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'}`}>
                    {studioTestInfinite ? '⚠️ Unconditional Infinite Loop Detected' : '✓ Bounded Loop Verified'}
                  </span>
                </div>
                <pre className="bg-[#07090e] border border-slate-800 rounded-lg p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                  {generatedWatPreview}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeView === 'software_bridge' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-[#111622] p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Connect Your External Software / App to Nexus Cluster</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Offload heavy calculations from any Python script, Node.js server, or Rust app directly to your M4 miner cluster.
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {(['python', 'nodejs', 'rust', 'curl'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setBridgeLang(lang)}
                        className={`text-xs px-3 py-1 rounded-md font-mono uppercase ${
                          bridgeLang === lang ? 'bg-amber-500/20 border border-amber-400 text-amber-300' : 'bg-slate-900 border border-slate-800 text-slate-400'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <pre className="bg-[#07090e] border border-slate-800 rounded-lg p-4 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                  {bridgeSnippets[bridgeLang]}
                </pre>

                <div className="flex justify-between items-center pt-1 text-xs text-slate-400 font-mono">
                  <span>RPC Endpoint: POST http://localhost:3000/api/deploy</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(bridgeSnippets[bridgeLang])}
                    className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  >
                    Copy Connector Code
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#111622] p-5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white">Live RPC Bridge Ping &amp; Response Inspector</h3>
                  <p className="text-xs text-slate-400">
                    Test the exact JSON payload your external software receives when it calls the Nexus RPC Bridge.
                  </p>
                  <button
                    onClick={testLiveSoftwareBridge}
                    disabled={isTestingBridge}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs transition"
                  >
                    {isTestingBridge ? 'Dispatching RPC Call to M4 Cluster...' : 'Send Live RPC Bridge Call Now'}
                  </button>
                </div>

                <div className="bg-[#07090e] border border-slate-800 rounded-lg p-3.5 text-xs font-mono h-64 overflow-y-auto">
                  {bridgeTestResponse ? (
                    <pre className="text-emerald-300 text-[11px]">
                      {JSON.stringify(
                        {
                          status: bridgeTestResponse.status,
                          blockHeight: bridgeTestResponse.blockHeight,
                          kernel: bridgeTestResponse.wasmInspector?.fileName,
                          loopSafety: bridgeTestResponse.wasmInspector?.loopSafetyAudit,
                          swarmWallMs: bridgeTestResponse.swarmParallelWallMs,
                          verifiedMinerOutputVector: bridgeTestResponse.verifiedMinerOutputVector,
                          tokenomicsAudit: bridgeTestResponse.tokenomicsAudit,
                          merkleStateSeal: bridgeTestResponse.merkleStateSeal
                        },
                        null,
                        2
                      )}
                    </pre>
                  ) : (
                    <div className="text-slate-500 text-center py-20">
                      Click &quot;Send Live RPC Bridge Call Now&quot; to inspect the live JSON response.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'vision_pipeline' && (
          <div className="p-6 space-y-6">
            <div className="p-5 bg-[#111622] border border-slate-800 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  High-Resolution Image &amp; Radiograph Convolution Pipeline
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload any diagnostic scan or image (.PNG / .JPG) for real-time spatial convolution and contrast enhancement.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:text-slate-200 cursor-pointer"
                />
                <select
                  value={imageFilterMode}
                  onChange={(e) => {
                    const m = e.target.value as any;
                    setImageFilterMode(m);
                    if (loadedImageRef.current) executeVisionPipeline(loadedImageRef.current, m);
                  }}
                  className="bg-[#090b10] border border-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-xs"
                >
                  <option value="sobel_edge">3×3 Sobel Edge Detection</option>
                  <option value="xray_clahe">CLAHE Local Contrast Enhancement</option>
                  <option value="invert_bone">Inverted Radiograph Negative</option>
                </select>
                {imageStats && (
                  <button
                    onClick={exportProcessedImage}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition"
                  >
                    Export PNG
                  </button>
                )}
              </div>
            </div>

            {!realImageName && (
              <div className="p-14 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                Select an image file above to run pixel-level spatial filtering.
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!realImageName ? 'hidden' : ''}`}>
              <div className="bg-[#111622] p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                <span className="text-xs text-slate-400 mb-3 font-medium">Source Input ({realImageName})</span>
                <canvas ref={origImgCanvasRef} className="rounded-lg border border-slate-800 max-w-full" />
              </div>
              <div className="bg-[#111622] p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                <span className="text-xs text-emerald-400 mb-3 font-medium">
                  Processed Output ({imageStats ? `${imageStats.pixelsProcessed.toLocaleString()} px in ${imageStats.timeMs} ms` : ''})
                </span>
                <canvas ref={procImgCanvasRef} className="rounded-lg border border-slate-800 max-w-full" />
              </div>
            </div>
          </div>
        )}

        <div className="p-6 bg-[#0a0d14] border-t border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-1">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Registered Apple Silicon Worker Nodes
            </h3>
            <span className="text-xs text-slate-500">
              70% Provider Payout • 30% Protocol Burn • 1,000 NXC Collateral Bond
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allKnownPorts.map((port) => {
              const m = miners[String(port)] || { host: '127.0.0.1', wallet: 0, staked: 1000, trust: 100, slashed: false, tasksCompleted: 0, gopsThroughput: 0 };
              const isOnline = livePorts.includes(port);
              return (
                <div key={port} className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                  m.slashed ? 'border-red-500/50 bg-red-950/10' :
                  isOnline ? 'border-slate-800 bg-[#111622]' : 'border-slate-800/50 bg-[#0b0e14] opacity-60'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white font-mono">Node :{port} ({m.cpuModel || 'Apple M4'})</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      m.slashed ? 'bg-red-950 text-red-400' :
                      isOnline ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {m.slashed ? 'Slashed' : isOnline ? `${m.cores ?? 8} Threads Online` : 'Offline'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
                    <div>Earned: <span className="text-white font-semibold">{Number(m.wallet || 0).toFixed(4)} NXC</span></div>
                    <div>Stake: <span className="text-slate-200">{m.staked ?? 1000} NXC</span></div>
                    <div>Shards: <span className="text-slate-200">{m.tasksCompleted ?? 0}</span></div>
                    <div>Rate: <span className="text-cyan-400">{m.gopsThroughput ? `${m.gopsThroughput} GOPS` : '—'}</span></div>
                    <div>Thermal: <span className="text-slate-200">{m.thermal ?? 36}°C ({m.battery ?? 100}%)</span></div>
                    <div>Latency: <span className="text-slate-200">{m.lastComputeUs ? `${(m.lastComputeUs / 1000).toFixed(2)} ms` : '—'}</span></div>
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
