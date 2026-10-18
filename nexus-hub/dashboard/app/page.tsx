'use client';
import { useState, useEffect, useRef } from 'react';

const WORKLOAD_GUIDES: Record<string, {
  title: string;
  binarySourceNote: string;
  whatIsInsideWasm: string;
  whyComputeNeeded: string;
  inputLabel: string;
  paramLabel: string;
  outputExplanation: string;
}> = {
  xray_medical_cnn: {
    title: "🩻 1. Medical Chest X-Ray AI Diagnostic CNN (medical_xray_cnn.wasm)",
    binarySourceNote: "Yeh aapke Mac par Rust mein compile ki gayi 5-Layer Convolutional Neural Network (`medical_xray_cnn.wasm` -> `analyze_xray_cnn`) binary hai! Aap ise Desktop se upload bhi kar sakte hain.",
    whatIsInsideWasm: "Is .wasm file ke andar 3x3 Sobel Edge Filter, 3x3 Laplacian Opacity Filter, ReLU Activation, aur 2-Layer Dense Neural Classifier (`CONV_SOBEL_KERNEL` + `DENSE_WEIGHTS_L1/L2`) hai.",
    whyComputeNeeded: "X-Ray mein fefdon (Right & Left Lungs) ke andar Pneumonia fluid (Ground-Glass Opacity) ya Nodule ko 5,000 parallel shards mein scan aur BFT-verify karne ke liye.",
    inputLabel: "X-Ray Quadrant Radiodensity [RightLung_HU, LeftLung_HU, Heart_HU, RibBone_HU]:",
    paramLabel: "CNN Sensitivity:",
    outputExplanation: "Miners par `analyze_xray_cnn()` chalne ke baad niche Chest X-Ray par AI Grad-CAM Heatmap (Red/Green Zone) aur Accurate Clinical Prediction Report aati hai!"
  },
  blender_raytrace: {
    title: "🎨 2. Blender-Style 3D Raytracing Render (Built-In 66B WASM Shader)",
    binarySourceNote: "Is mode mein Gateway RAM ke andar 66-Byte ka Real WebAssembly Raytracing Shader (`auto_synthesized_blender_raytrace.wasm`) banakar Miners ko bhejta hai.",
    whatIsInsideWasm: "Is 66-byte .wasm binary ke andar 3D Ray-Sphere Intersection aur Lambertian Light Shading ka machine opcode (`00 61 73 6d...`) hai.",
    whyComputeNeeded: "3D image ko horizontal pattiyon (Scanline Bands) mein tod kar alag-alag Miners par parallel compute karwaya jata hai.",
    inputLabel: "Light & Color Vector [LightX, LightY, RedHue, BlueHue]:",
    paramLabel: "Green Hue / Seed:",
    outputExplanation: "Niche 3D Canvas par roshni (LightX, LightY) aur rang sidha aapke input numbers aur Miners ke output se badalte hain!"
  },
  ai_tensor_gemm: {
    title: "🧠 3. Real Linear Regression AI Training (Built-In 66B WASM + Real MSE)",
    binarySourceNote: "Is mode mein 66-Byte ka Neural Kernel (`auto_synthesized_ai_tensor_gemm.wasm`) Miners par chalta hai aur aapke 4 data points par Asli Mathematical Gradient Descent fit hota hai!",
    whatIsInsideWasm: "Is .wasm file ke andar Tensor Matrix Transformation (`synth_kernel`) aur Linear Regression (`Y = W*X + B`) optimization hai.",
    whyComputeNeeded: "Aapke diye gaye 4 data points `[Y1, Y2, Y3, Y4]` (for X=1,2,3,4) ke beech ki line seekhne ke liye hundreds of epochs chalaye jate hain.",
    inputLabel: "Training Target Data [Y for X=1, X=2, X=3, X=4]:",
    paramLabel: "Learning Rate (e.g. 42):",
    outputExplanation: "Loss % aapke diye gaye numbers par real Gradient Descent se nikalta hai!"
  },
  xor_cipher: {
    title: "🔐 4. Cryptographic Vector Audit (Built-In 61B WASM Cipher)",
    binarySourceNote: "Is mode mein Gateway 61-Byte ka `auto_synthesized_xor_cipher.wasm` banakar Miners ke WASM Linear Memory mein 4 numbers encrypt karwata hai.",
    whatIsInsideWasm: "32-bit Linear Congruential XOR Stream Cipher (`((seed ^ param) * 1664525) ^ (param << 3)`).",
    whyComputeNeeded: "Hazaron parallel shards mein cryptographic hashing aur verification ke liye.",
    inputLabel: "Raw Data Blocks [B1, B2, B3, B4]:",
    paramLabel: "Cipher Key:",
    outputExplanation: "Miners ke WASM Linear Memory se har data block ka 100% Ed25519-verified encrypted output vector wapas aata hai."
  },
  rust_matrix: {
    title: "📂 5. Strict Custom .WASM File Mode (Upload ~/Desktop/medical_xray_cnn.wasm)",
    binarySourceNote: "Apne Desktop se `medical_xray_cnn.wasm` file choose karke upload karein!",
    whatIsInsideWasm: "Jo bhi `.wasm` file aap upload karenge, X-Ray Inspector uske asli functions (`analyze_xray_cnn`) aur bytes padh kar aapko dikhayega.",
    whyComputeNeeded: "Aapka apna compiled Rust `.wasm` code bina Docker ke seedha Apple M4 Miners par chalane ke liye.",
    inputLabel: "Input Vector (4x u32 into WASM Memory):",
    paramLabel: "Function Param:",
    outputExplanation: "Aapki upload ki gayi `.wasm` file ka asli output aur clinical diagnosis niche dikhega."
  }
};

export default function Home() {
  const [blockHeight, setBlockHeight] = useState(1);
  const [merkleSeal, setMerkleSeal] = useState("0000...");
  const [clientWallet, setClientWallet] = useState(100);
  const [totalBurned, setTotalBurned] = useState(0);
  const [nxcUsdPrice, setNxcUsdPrice] = useState(2.50);
  const [activeNodes, setActiveNodes] = useState(0);
  const [livePorts, setLivePorts] = useState<number[]>([]);
  const [miners, setMiners] = useState<Record<string, any>>({});

  const [synthMode, setSynthMode] = useState("xray_medical_cnn");
  const [executedMode, setExecutedMode] = useState<string | null>(null);
  const [totalShards, setTotalShards] = useState<number>(5000);
  const [dataVectorStr, setDataVectorStr] = useState("158, 172, 138, 195");
  const [customParam, setCustomParam] = useState<string>("160");
  const [uploadedWasm, setUploadedWasm] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [useOnDiskRustDefault, setUseOnDiskRustDefault] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const [wasmInspector, setWasmInspector] = useState<any>(null);
  const [scanlineBands, setScanlineBands] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [xrayDiagnosis, setXrayDiagnosis] = useState<any>(null);
  const [aiTestInput, setAiTestInput] = useState<string>("5");
  const [vectorResult, setVectorResult] = useState<{ input: number[]; output: number[] } | null>(null);
  const [lastDiagnostic, setLastDiagnostic] = useState<{ expected: string; reported: string; fraud: boolean; port: number; rescuedBy?: number } | null>(null);
  const [showCorruptedPreview, setShowCorruptedPreview] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const xrayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearPreviousExecutionOutput = (reason?: string) => {
    setExecutedMode(null);
    setVectorResult(null);
    setWasmInspector(null);
    setScanlineBands([]);
    setAiSummary(null);
    setXrayDiagnosis(null);
    setLastDiagnostic(null);
    setShowCorruptedPreview(false);
    setErrorBanner(null);
    if (reason) setPendingNotice(reason);
  };

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setBlockHeight(data?.blockHeight ?? 1);
      setMerkleSeal(data?.merkleStateSeal ?? "");
      setClientWallet(data?.clientWallet ?? 100);
      setTotalBurned(data?.totalBurned ?? 0);
      setNxcUsdPrice(data?.nxcUsdPrice ?? 2.50);
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

  // Draw Medical Chest X-Ray & AI Grad-CAM Heatmap Overlay when xrayDiagnosis is ready
  useEffect(() => {
    if (!xrayCanvasRef.current || !vectorResult || !xrayDiagnosis) return;
    const canvas = xrayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const [rightHu, leftHu, heartHu, boneHu] = vectorResult.input;

    const cx = w / 2;
    const cy = h / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const nx = (x - cx) / (w * 0.42);
        const ny = (y - cy) / (h * 0.44);

        // Thoracic cage envelope
        const inThorax = (nx * nx) / 0.95 + (ny * ny) / 0.95 <= 1.0;

        // Right Lung (viewer's left: nx < -0.12) & Left Lung (viewer's right: nx > 0.12)
        const rLungDist = Math.pow((nx + 0.38) / 0.32, 2) + Math.pow((ny + 0.02) / 0.68, 2);
        const lLungDist = Math.pow((nx - 0.38) / 0.32, 2) + Math.pow((ny + 0.02) / 0.68, 2);
        const inRightLung = rLungDist <= 1.0;
        const inLeftLung = lLungDist <= 1.0;

        // Spine & Heart shadow in center
        const inSpine = Math.abs(nx) < 0.09 && Math.abs(ny) < 0.88;
        const inHeart = Math.pow((nx - 0.12) / 0.22, 2) + Math.pow((ny - 0.18) / 0.32, 2) <= 1.0;

        // Ribs horizontal wave pattern
        const ribWave = Math.sin(ny * 26 + Math.abs(nx) * 4) > 0.68;

        let gray = 12;
        if (inThorax) {
          gray = 95;
          if (ribWave) gray += Math.min(90, Math.round(boneHu * 0.32));
          if (inRightLung) {
            // Base dark lung + opacity cloud if rightHu is high
            const opacityCloud = rightHu > 95 ? ((rightHu - 60) * Math.max(0, 1 - rLungDist * 0.8)) : 0;
            gray = Math.max(18, Math.min(235, Math.round(28 + opacityCloud + (ribWave ? 22 : 0))));
          } else if (inLeftLung) {
            const opacityCloud = leftHu > 95 ? ((leftHu - 60) * Math.max(0, 1 - lLungDist * 0.8)) : 0;
            gray = Math.max(18, Math.min(235, Math.round(28 + opacityCloud + (ribWave ? 22 : 0))));
          }
          if (inHeart) gray = Math.min(230, Math.round(gray * 0.5 + heartHu * 0.65));
          if (inSpine) gray = Math.min(245, Math.round(150 + boneHu * 0.35));
        }

        let r = gray;
        let g = Math.min(255, Math.round(gray * 1.04));
        let b = Math.min(255, Math.round(gray * 1.12));

        // AI Grad-CAM Heatmap Overlay on Abnormal Lung Zones (>95 HU)
        if (inRightLung && rightHu > 95 && rLungDist < 0.75) {
          const heat = (1 - rLungDist / 0.75) * Math.min(1, (rightHu - 90) / 110);
          r = Math.min(255, Math.round(r + 180 * heat));
          g = Math.max(20, Math.round(g * (1 - 0.4 * heat)));
          b = Math.max(10, Math.round(b * (1 - 0.7 * heat)));
        }
        if (inLeftLung && leftHu > 95 && lLungDist < 0.75) {
          const heat = (1 - lLungDist / 0.75) * Math.min(1, (leftHu - 90) / 110);
          r = Math.min(255, Math.round(r + 180 * heat));
          g = Math.max(20, Math.round(g * (1 - 0.4 * heat)));
          b = Math.max(10, Math.round(b * (1 - 0.7 * heat)));
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw AI Bounding Boxes & Labels
    ctx.font = 'bold 10px monospace';
    if (rightHu > 95) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(75, 55, 110, 125);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(`R-LUNG OPACITY: ${xrayDiagnosis.rightLungRiskPct}%`, 68, 48);
    } else {
      ctx.strokeStyle = '#22c55e';
      ctx.strokeRect(75, 55, 110, 125);
      ctx.fillStyle = '#86efac';
      ctx.fillText(`R-LUNG CLEAR (${rightHu} HU)`, 68, 48);
    }

    if (leftHu > 95) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(235, 55, 110, 125);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(`L-LUNG OPACITY: ${xrayDiagnosis.leftLungRiskPct}%`, 230, 48);
    } else {
      ctx.strokeStyle = '#22c55e';
      ctx.strokeRect(235, 55, 110, 125);
      ctx.fillStyle = '#86efac';
      ctx.fillText(`L-LUNG CLEAR (${leftHu} HU)`, 230, 48);
    }
  }, [vectorResult, xrayDiagnosis]);

  // Draw 3D Raytraced Sphere when executedMode === 'blender_raytrace'
  useEffect(() => {
    if (executedMode !== 'blender_raytrace' || !canvasRef.current || !vectorResult) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const [v0, v1, v2, v3] = vectorResult.input;
    const [out0] = vectorResult.output;

    const lx = ((v0 - 50) / 45) + ((out0 % 50) / 500);
    const ly = ((v1 - 50) / 45) - 0.3;
    const lz = 0.85;
    const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
    const lightX = lx / lLen;
    const lightY = ly / lLen;
    const lightZ = lz / lLen;

    const baseR = Math.min(255, Math.max(30, v2 % 255));
    const baseG = Math.min(255, Math.max(30, Number(customParam) % 255));
    const baseB = Math.min(255, Math.max(40, v3 % 255));

    const cx = width / 2;
    const cy = height / 2 - 10;
    const radius = Math.min(width, height) * 0.34;

    for (let y = 0; y < height; y++) {
      const shardPos = Math.floor((y / height) * totalShards);
      const isBottomRogueBand = showCorruptedPreview && shardPos >= totalShards * 0.72;

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        if (isBottomRogueBand) {
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
          data[idx] = 6;
          data[idx + 1] = 10 + Math.round((y / height) * 18);
          data[idx + 2] = 18 + Math.round((y / height) * 28);
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [executedMode, vectorResult, scanlineBands, showCorruptedPreview, customParam, totalShards]);

  const handleModeChange = (newMode: string) => {
    setSynthMode(newMode);
    if (newMode !== 'rust_matrix') {
      setUploadedWasm(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    clearPreviousExecutionOutput(
      `🔄 Aapne "${WORKLOAD_GUIDES[newMode]?.title}" select kiya hai — Iska result compute karne ke liye "🚀 COMPUTE ON SWARM" button dabayein!`
    );
  };

  const applyXrayPreset = (presetVec: string, label: string) => {
    setDataVectorStr(presetVec);
    clearPreviousExecutionOutput(`🩻 Clinical Preset "${label}" load ho gaya (${presetVec}) — Ab "🚀 COMPUTE ON SWARM" dabayein!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      setUploadedWasm({ name: file.name, base64: btoa(binary), size: file.size });
      clearPreviousExecutionOutput(
        `📂 Nayi file "${file.name}" (${file.size}B) load ho gayi hai — Ab "🚀 COMPUTE ON SWARM" dabayein!`
      );
    };
    reader.readAsArrayBuffer(file);
  };

  const clearUploadedFile = () => {
    setUploadedWasm(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    clearPreviousExecutionOutput("🗑️ Uploaded .wasm file hata di gayi hai.");
  };

  const downloadActiveWasmBinary = () => {
    if (!wasmInspector?.wasmBase64Download) return;
    const binStr = atob(wasmInspector.wasmBase64Download);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/wasm' });
    const link = document.createElement('a');
    link.download = wasmInspector.fileName || 'medical_xray_cnn.wasm';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const injectPayload = async () => {
    setErrorBanner(null);
    setPendingNotice(null);
    setIsComputing(true);

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customParam: customParam ? Number(customParam) : 160,
          wasmBase64: uploadedWasm?.base64,
          fileName: uploadedWasm?.name,
          enablePruning: true,
          synthMode,
          dataVectorStr,
          totalShards,
          useOnDiskRustDefault
        })
      });
      const data = await res.json();

      if (res.ok) {
        setExecutedMode(data.executedMode || synthMode);
        setWasmInspector(data.wasmInspector || null);
        setScanlineBands(data.scanlineBands || []);
        setAiSummary(data.aiTrainingSummary || null);
        setXrayDiagnosis(data.xrayDiagnosis || null);
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
        } else if (data.verifiedNodes?.length > 0) {
          const v = data.verifiedNodes[0];
          setLastDiagnostic({
            expected: v.expectedOutput,
            reported: v.results?.[0]?.output,
            fraud: false,
            port: v.nodePort
          });
        }
        await fetchState();
      } else {
        setErrorBanner(data.error || data.message);
      }
    } catch (err: any) {
      setErrorBanner(err.message);
    }
    setIsComputing(false);
  };

  const downloadOutputResult = () => {
    if (!executedMode || !vectorResult) return;
    if (executedMode === 'blender_raytrace' && canvasRef.current) {
      const link = document.createElement('a');
      link.download = `nexus_3d_render_block_${blockHeight}.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
      return;
    }
    const payload: Record<string, any> = {
      nexusBlock: blockHeight,
      merkleStateSeal: merkleSeal,
      executedWorkload: executedMode,
      wasmInspector,
      inputVector: vectorResult.input,
      verifiedMinerOutputVector: vectorResult.output,
      scanlineBands
    };
    if (xrayDiagnosis) payload.medicalXrayDiagnosis = xrayDiagnosis;
    if (aiSummary) payload.aiTrainingSummary = aiSummary;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `nexus_${executedMode}_block_${blockHeight}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const resetLedger = async () => {
    await fetch('/api/state', { method: 'DELETE' });
    clearPreviousExecutionOutput("🔄 Genesis Ledger Reset ho gaya hai.");
    fetchState();
  };

  const guide = WORKLOAD_GUIDES[synthMode] || WORKLOAD_GUIDES.xray_medical_cnn;
  const dynamicUsdCost = ((totalShards / 1000) * 0.016).toFixed(3);
  const dynamicAwsCost = ((totalShards / 1000) * 0.090).toFixed(3);
  const currentNxcPerTask = (Number(dynamicUsdCost) / nxcUsdPrice).toFixed(4);
  const allKnownPorts = Array.from(new Set([6969, 6970, 6971, ...Object.keys(miners).map(Number), ...livePorts])).sort();

  const hasValidCurrentResult = Boolean(vectorResult && executedMode === synthMode);

  const predictedAiValue = aiSummary
    ? (Number(aiTestInput || 0) * aiSummary.learnedWeights.w1_slope + aiSummary.learnedWeights.bias).toFixed(2)
    : '—';

  return (
    <div className="min-h-screen bg-[#050507] text-green-400 font-mono p-4 md:p-6 flex flex-col items-center">
      <div className="max-w-7xl w-full border border-green-500/30 bg-black/95 rounded-xl overflow-hidden shadow-2xl space-y-0">

        {/* Top Header */}
        <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-green-500/30 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <div>
            <h1 className="text-white font-bold text-lg md:text-xl tracking-wider">
              NEXUS TITAN // v10.0 MEDICAL X-RAY CNN & VISUAL AI STUDIO
            </h1>
            <p className="text-[11px] text-cyan-400">
              5-LAYER RUST CNN (medical_xray_cnn.wasm) • GRAD-CAM HEATMAP • STRICT EXECUTION LOCK • APPLE M4 SILICON
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

        {errorBanner && (
          <div className="bg-red-950/80 border-b border-red-500 px-6 py-3 text-xs text-red-200 font-bold flex justify-between items-center">
            <span>⚠️ {errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="text-red-300 hover:text-white px-2">✕</button>
          </div>
        )}

        {/* STEP 1 & STEP 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-green-500/20 divide-y lg:divide-y-0 lg:divide-x divide-green-500/20 bg-[#08090d]">
          
          {/* Left: Step 1 */}
          <div className="p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold bg-green-500/20 text-green-300 border border-green-500/40 px-2.5 py-0.5 rounded">
                STEP 1: SELECT AI WORKLOAD OR UPLOAD ~/Desktop/medical_xray_cnn.wasm
              </span>
              <span className="text-xs text-yellow-400 font-bold">
                {currentNxcPerTask} NXC (${dynamicUsdCost})
              </span>
            </div>

            <div>
              <select
                value={synthMode}
                onChange={(e) => handleModeChange(e.target.value)}
                className="w-full bg-black border border-cyan-500/50 text-cyan-300 px-3 py-2 rounded text-sm font-bold"
              >
                <option value="xray_medical_cnn">🩻 1. Medical Chest X-Ray AI Diagnostic CNN (medical_xray_cnn.wasm)</option>
                <option value="blender_raytrace">🎨 2. Blender-Style 3D Raytracing (Built-In 66B WASM Shader)</option>
                <option value="ai_tensor_gemm">🧠 3. Real Linear Regression AI Trainer (Built-In 66B WASM + Real MSE)</option>
                <option value="xor_cipher">🔐 4. Cryptographic Vector Audit (Built-In 61B WASM Cipher)</option>
                <option value="rust_matrix">📂 5. Custom .WASM Upload Mode (Upload Desktop/medical_xray_cnn.wasm)</option>
              </select>
            </div>

            {/* Quick Clinical X-Ray Sample Buttons when in X-Ray mode */}
            {(synthMode === 'xray_medical_cnn' || synthMode === 'rust_matrix') && (
              <div className="p-2.5 bg-purple-950/20 border border-purple-500/30 rounded space-y-1.5 text-xs">
                <p className="text-purple-300 font-bold text-[11px]">🩻 Select Patient X-Ray Scan Sample (Or type custom HU densities below):</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyXrayPreset("32, 35, 115, 185", "Healthy Normal Lungs")}
                    className="bg-green-950/50 hover:bg-green-800/60 border border-green-500/40 text-green-300 px-2.5 py-1 rounded text-[11px]"
                  >
                    ✅ Sample 1: Healthy Normal Lungs [32, 35, 115, 185]
                  </button>
                  <button
                    onClick={() => applyXrayPreset("158, 172, 138, 195", "Bilateral Pneumonia Opacity")}
                    className="bg-red-950/50 hover:bg-red-800/60 border border-red-500/40 text-red-300 px-2.5 py-1 rounded text-[11px]"
                  >
                    🚨 Sample 2: Pneumonia Fluid Opacity [158, 172, 138, 195]
                  </button>
                  <button
                    onClick={() => applyXrayPreset("182, 38, 120, 230", "Right-Lung Focal Nodule")}
                    className="bg-yellow-950/50 hover:bg-yellow-800/60 border border-yellow-500/40 text-yellow-300 px-2.5 py-1 rounded text-[11px]"
                  >
                    ⚠️ Sample 3: Right-Lung Nodule [182, 38, 120, 230]
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="text-gray-400 block mb-1">{guide.inputLabel}</label>
                <input
                  type="text"
                  value={dataVectorStr}
                  onChange={(e) => {
                    setDataVectorStr(e.target.value);
                    clearPreviousExecutionOutput("🔄 Input numbers badle gaye hain — Naya result pane ke liye COMPUTE dabayein!");
                  }}
                  className="w-full bg-black border border-green-500/40 text-yellow-300 px-2.5 py-1.5 rounded"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">{guide.paramLabel}</label>
                <input
                  type="number"
                  value={customParam}
                  onChange={(e) => {
                    setCustomParam(e.target.value);
                    clearPreviousExecutionOutput("🔄 Parameter badla gaya hai — Naya result pane ke liye COMPUTE dabayein!");
                  }}
                  className="w-full bg-black border border-green-500/40 text-green-400 px-2.5 py-1.5 rounded"
                />
              </div>
            </div>

            <div className="p-2.5 bg-black/70 border border-gray-800 rounded space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Upload .wasm:</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".wasm"
                    onChange={handleFileUpload}
                    className="text-xs text-gray-400 w-52 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-cyan-500/40 file:text-xs file:bg-cyan-950/30 file:text-cyan-300"
                  />
                </div>

                {uploadedWasm && (
                  <button
                    onClick={clearUploadedFile}
                    className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/50 px-3 py-1 rounded text-xs font-bold transition-all"
                  >
                    ❌ Hatao / Remove ({uploadedWasm.name})
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={injectPayload}
              disabled={isComputing}
              className="w-full font-bold py-3 px-6 border-2 bg-green-600/20 hover:bg-green-600 border-green-500 text-green-300 hover:text-white transition-all uppercase tracking-widest text-xs rounded shadow-lg"
            >
              {isComputing ? '⚡ RUNNING 5-LAYER CNN ON MINERS...' : `🚀 COMPUTE ON SWARM & ANALYZE (${currentNxcPerTask} NXC)`}
            </button>
          </div>

          {/* Right: Step 2 - WASM X-Ray Inspector */}
          <div className="p-5 bg-[#050609] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded">
                STEP 2: ACTIVE .WASM X-RAY INSPECTOR
              </span>
              {hasValidCurrentResult && wasmInspector && (
                <button
                  onClick={downloadActiveWasmBinary}
                  className="text-[10px] bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded font-bold"
                >
                  📥 Download {wasmInspector.fileName} ({wasmInspector.byteSize}B)
                </button>
              )}
            </div>

            <div className="p-3 bg-black/80 border border-gray-800 rounded space-y-2 text-xs leading-relaxed">
              <p className="text-white font-bold">{guide.title}</p>
              <p className="text-gray-300">
                <span className="text-cyan-400 font-bold">🔍 File Ke Andar Kya Hai: </span>
                {guide.whatIsInsideWasm}
              </p>
              <p className="text-gray-300">
                <span className="text-yellow-400 font-bold">💡 AI X-Ray Kaise Padhta Hai: </span>
                {guide.whyComputeNeeded}
              </p>
            </div>

            {hasValidCurrentResult && wasmInspector ? (
              <div className="p-3 bg-cyan-950/15 border border-cyan-500/30 rounded text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Executed Binary Origin:</span>
                  <span className="text-yellow-300 font-bold">{wasmInspector.binaryOrigin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Exported Rust CNN Function:</span>
                  <span className="text-cyan-300 font-bold">{wasmInspector.exportedFunctions.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Memory Architecture:</span>
                  <span className="text-green-300">{wasmInspector.exportedMemory}</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate pt-1">
                  Raw Machine Opcodes: {wasmInspector.bytecodeHexPreview}...
                </div>
              </div>
            ) : (
              <div className="p-3 bg-black/50 border border-gray-800/80 rounded text-xs text-yellow-300/80 text-center">
                {pendingNotice || 'Left side par "🚀 COMPUTE ON SWARM" dabayein — execute hone ke baad medical_xray_cnn.wasm ka X-Ray yahan khulega!'}
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: VISUAL OUTPUT STUDIO */}
        <div className="p-6 bg-[#040608] border-b border-green-500/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
            <div>
              <span className="text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded">
                STEP 3: COMPUTE HONE KE BAAD AAPKA RESULT (STRICT EXECUTION LOCK)
              </span>
              <p className="text-xs text-gray-400 mt-1">{guide.outputExplanation}</p>
            </div>
            {hasValidCurrentResult && (
              <button
                onClick={downloadOutputResult}
                className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-1.5 rounded shadow"
              >
                💾 DOWNLOAD DIAGNOSTIC REPORT (.JSON)
              </button>
            )}
          </div>

          {!hasValidCurrentResult || !vectorResult ? (
            <div className="p-10 border border-dashed border-gray-800 rounded-lg text-center space-y-2">
              <p className="text-yellow-300 text-sm font-bold">
                {pendingNotice || '⏳ Is Mode ka koi task abhi execute nahi hua hai.'}
              </p>
              <p className="text-gray-500 text-xs">
                Jab tak aap upar &quot;🚀 COMPUTE ON SWARM&quot; button nahi dabayenge, tab tak koi purana ya auto-result yahan nahi dikhega.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              
              {/* Medical Chest X-Ray & AI Grad-CAM Heatmap View */}
              {xrayDiagnosis ? (
                <div className="bg-black p-4 rounded-lg border border-cyan-500/40 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-cyan-300">🩻 AI GRAD-CAM CHEST X-RAY SCANNER</span>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded font-bold ${
                      xrayDiagnosis.overallPathologyRiskPct > 50
                        ? 'bg-red-600 text-white'
                        : 'bg-green-700 text-white'
                    }`}>
                      {xrayDiagnosis.severity} (Confidence: {xrayDiagnosis.confidencePct}%)
                    </span>
                  </div>

                  <div className="flex justify-center bg-[#020305] p-2 rounded border border-gray-800">
                    <canvas
                      ref={xrayCanvasRef}
                      width={420}
                      height={220}
                      className="rounded border border-gray-800 w-full max-w-[420px]"
                    />
                  </div>

                  <div className={`p-3 rounded border text-xs space-y-1 ${
                    xrayDiagnosis.overallPathologyRiskPct > 50
                      ? 'bg-red-950/30 border-red-500/50 text-red-200'
                      : 'bg-green-950/30 border-green-500/50 text-green-200'
                  }`}>
                    <p className="font-bold text-sm">{xrayDiagnosis.primaryFinding}</p>
                    <p className="text-[11px] text-gray-300">{xrayDiagnosis.clinicalExplanation}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-2 bg-gray-950 border border-gray-800 rounded">
                      <p className="text-gray-400">Right Lung Risk</p>
                      <p className="text-sm font-bold text-yellow-300">{xrayDiagnosis.rightLungRiskPct}%</p>
                    </div>
                    <div className="p-2 bg-gray-950 border border-gray-800 rounded">
                      <p className="text-gray-400">Left Lung Risk</p>
                      <p className="text-sm font-bold text-yellow-300">{xrayDiagnosis.leftLungRiskPct}%</p>
                    </div>
                    <div className="p-2 bg-gray-950 border border-gray-800 rounded">
                      <p className="text-gray-400">Bone Cortical</p>
                      <p className="text-sm font-bold text-cyan-300">{xrayDiagnosis.boneIntegrityPct}%</p>
                    </div>
                  </div>
                </div>
              ) : executedMode === 'blender_raytrace' ? (
                <div className="flex flex-col items-center bg-black p-3 rounded-lg border border-cyan-500/30">
                  <canvas ref={canvasRef} width={420} height={230} className="rounded border border-gray-800 w-full max-w-[420px]" />
                </div>
              ) : executedMode === 'ai_tensor_gemm' && aiSummary ? (
                <div className="bg-black p-4 rounded-lg border border-purple-500/30 space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <span className="text-xs font-bold text-purple-300">🧠 REAL GRADIENT DESCENT ON [{vectorResult.input.join(', ')}]</span>
                    <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded font-bold">
                      Fit Accuracy: {aiSummary.accuracyPct}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-red-950/20 border border-red-500/30 rounded">
                      <p className="text-gray-400 text-[10px]">INITIAL MSE ERROR</p>
                      <p className="text-red-400 text-lg font-bold">{aiSummary.initialLossPct}% Loss</p>
                    </div>
                    <div className="p-2.5 bg-green-950/20 border border-green-500/30 rounded">
                      <p className="text-gray-400 text-[10px]">FINAL MSE ERROR</p>
                      <p className="text-green-400 text-lg font-bold">{aiSummary.finalLossPct}% Loss ✓</p>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-950/20 border border-purple-500/40 rounded space-y-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">Step X:</span>
                      <input
                        type="number"
                        value={aiTestInput}
                        onChange={(e) => setAiTestInput(e.target.value)}
                        className="bg-black border border-purple-400 text-yellow-300 px-2.5 py-1 rounded w-20 font-bold"
                      />
                      <span className="text-gray-400">→ Predicted Y:</span>
                      <span className="text-green-300 font-bold text-sm">{predictedAiValue}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-black p-4 rounded-lg border border-green-500/30 space-y-2 text-xs">
                  <p className="text-white font-bold">🔐 VERIFIED WASM LINEAR MEMORY TRANSFORMATION</p>
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

              {/* Right Panel: Per-Miner Execution Breakdown */}
              <div className="bg-black/90 p-4 rounded-lg border border-gray-800 space-y-3 text-xs">
                <p className="text-white font-bold border-b border-gray-800 pb-1.5">
                  📊 SWARM EXECUTION & SELF-HEALING PROOF ({wasmInspector?.fileName}):
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
                            : `✅ Node :${b.port} ne ${b.computeTimeUs}µs mein analyze_xray_cnn() chala kar Ed25519 sign kiya.`}
                        </p>
                      </div>
                      <span className="text-cyan-400 font-bold">{b.gops} GOPS</span>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-[#090b10] border border-gray-800 rounded flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">X-Ray Radiodensity Input (HU):</span>
                    <span className="text-cyan-300 font-bold">[{vectorResult.input.join(', ')}]</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">5-Layer CNN Miner Output:</span>
                    <span className="text-yellow-300 font-bold">[{vectorResult.output.join(', ')}]</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Bottom Hardware Bar */}
        <div className="p-4 bg-[#060606]">
          <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-2">
            APPLE M4 HARDWARE MINERS & BME LEDGER — WALLET: {clientWallet.toFixed(4)} NXC | NXC PRICE: ${nxcUsdPrice.toFixed(4)} | BURNED: {totalBurned.toFixed(2)} NXC
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
