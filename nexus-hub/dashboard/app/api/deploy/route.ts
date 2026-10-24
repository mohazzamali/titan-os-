import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dgram from 'dgram';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { spawn } from 'child_process';
import { getInitialState, probeLiveNodesWithNcip, computeStateMerkleSeal } from '../state/route';

const SAFE_UDP_CHUNK_BYTES = 8192;
const gatewayWasmCache = new Map<string, { module: WebAssembly.Module; expectedMap: Map<string, { vec: number[]; matrix: number[]; nativeMs: number; memPages: number }> }>();

let ledgerMutex: Promise<any> = Promise.resolve();
function withLedgerLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = ledgerMutex.then(fn, fn);
  ledgerMutex = next.catch(() => {});
  return next;
}

function getLocalLanIp(): string {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {}
  return '127.0.0.1';
}

function canonicalizeOutput(val: any): number {
  if (typeof val === 'bigint') return Number(val & 0xffffffffn) >>> 0;
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  if (!Number.isInteger(num)) return Math.round(num * 10000);
  return num >>> 0;
}

function scanWasmForUnconditionalInfiniteLoops(wasmBuf: Buffer): { safe: boolean; reason?: string; loopsDetected: number } {
  let loopsDetected = 0;
  for (let i = 8; i < wasmBuf.length - 2; i++) {
    if (wasmBuf[i] === 0x03 && (wasmBuf[i + 1] === 0x40 || wasmBuf[i + 1] === 0x7f)) {
      loopsDetected++;
      let depth = 1;
      let hasConditionalExit = false;
      let hasUnconditionalLoopBack = false;
      for (let j = i + 2; j < Math.min(wasmBuf.length, i + 4096); j++) {
        const op = wasmBuf[j];
        if (op === 0x02 || op === 0x03 || op === 0x04) depth++;
        if (op === 0x04 || op === 0x0d || op === 0x0e || op === 0x0f) hasConditionalExit = true;
        if (op === 0x0c && wasmBuf[j + 1] === 0x00 && depth === 1) hasUnconditionalLoopBack = true;
        if (op === 0x0b) {
          depth--;
          if (depth === 0) break;
        }
      }
      if (hasUnconditionalLoopBack && !hasConditionalExit) {
        return {
          safe: false,
          loopsDetected,
          reason: `STATIC INFINITE LOOP BANNED: Bytecode offset 0x${i.toString(16).toUpperCase()} contains an unconditional 'loop ... br 0' with no exit condition (br_if / return).`
        };
      }
    }
  }
  return { safe: true, loopsDetected };
}

function encodeU32Leb(val: number): number[] {
  const bytes: number[] = [];
  let v = val >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return bytes;
}

function encodeS32Leb(val: number): number[] {
  const bytes: number[] = [];
  let more = true;
  let v = val | 0;
  while (more) {
    let b = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (b & 0x40) === 0) || (v === -1 && (b & 0x40) !== 0)) {
      more = false;
    } else {
      b |= 0x80;
    }
    bytes.push(b);
  }
  return bytes;
}

export function buildCustomWasmBinary(spec: {
  iterations: number;
  multiplier: number;
  addConstant: number;
  shiftBits: number;
  mixOp: 'xor' | 'add' | 'mul';
  injectInfiniteLoop?: boolean;
}): Buffer {
  const iters = Math.max(1, Math.min(20000000, Number(spec.iterations) || 50000));
  const mult = Number(spec.multiplier) || 1664525;
  const addC = Number(spec.addConstant) || 1013904223;
  const shift = Math.max(1, Math.min(31, Number(spec.shiftBits) || 13));
  const mixOpcode = spec.mixOp === 'add' ? 0x6a : spec.mixOp === 'mul' ? 0x6c : 0x73;

  const bodyInstructions: number[] = [
    0x01, 0x03, 0x7f,
    0x20, 0x00,
    0x41, ...encodeS32Leb(addC),
    0x73,
    0x20, 0x01,
    0x6a,
    0x21, 0x02,
    0x41, ...encodeS32Leb(iters),
    0x21, 0x03,
  ];

  if (spec.injectInfiniteLoop) {
    bodyInstructions.push(
      0x03, 0x40,
      0x20, 0x02,
      0x41, ...encodeS32Leb(mult),
      0x6c,
      0x21, 0x02,
      0x0c, 0x00,
      0x0b
    );
  } else {
    bodyInstructions.push(
      0x03, 0x40,
        0x20, 0x02,
        0x41, ...encodeS32Leb(mult),
        0x6c,
        0x20, 0x02,
        0x41, ...encodeS32Leb(shift),
        0x76,
        0x20, 0x01,
        0x6a,
        0x20, 0x03,
        0x6a,
        mixOpcode,
        0x21, 0x02,

        0x41, ...encodeS32Leb(0x30000),
        0x20, 0x03,
        0x41, 0x3f,
        0x71,
        0x41, 0x02,
        0x74,
        0x6a,
        0x20, 0x02,
        0x36, 0x02, 0x00,

        0x20, 0x03,
        0x41, 0x01,
        0x6b,
        0x22, 0x03,
        0x41, 0x00,
        0x4a,
        0x0d, 0x00,
      0x0b
    );
  }

  bodyInstructions.push(0x20, 0x02, 0x0b);

  const typeSection = [0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f];
  const funcSection = [0x03, 0x02, 0x01, 0x00];
  const memSection  = [0x05, 0x03, 0x01, 0x00, 0x10];
  const expName = Buffer.from('execute_task', 'utf8');
  const memName = Buffer.from('memory', 'utf8');
  const exportPayload = [
    0x02,
    memName.length, ...Array.from(memName), 0x02, 0x00,
    expName.length, ...Array.from(expName), 0x00, 0x00
  ];
  const exportSection = [0x07, ...encodeU32Leb(exportPayload.length), ...exportPayload];

  const funcBody = [...encodeU32Leb(bodyInstructions.length), ...bodyInstructions];
  const codePayload = [0x01, ...funcBody];
  const codeSection = [0x0a, ...encodeU32Leb(codePayload.length), ...codePayload];

  return Buffer.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...typeSection,
    ...funcSection,
    ...memSection,
    ...exportSection,
    ...codeSection
  ]);
}

const PRESET_KERNELS: Record<string, { fileName: string; label: string; spec: { iterations: number; multiplier: number; addConstant: number; shiftBits: number; mixOp: 'xor' | 'add' | 'mul' } }> = {
  quant_monte_carlo: {
    fileName: 'quant_monte_carlo.wasm',
    label: 'Quantitative Finance — Monte Carlo Option Pricing Fold',
    spec: { iterations: 250000, multiplier: 1664525, addConstant: 1013904223, shiftBits: 11, mixOp: 'xor' }
  },
  zk_sha256_merkle: {
    fileName: 'zk_sha256_merkle.wasm',
    label: 'Zero-Knowledge (ZK) — Bitwise Merkle Proof Hasher',
    spec: { iterations: 300000, multiplier: 2045885385, addConstant: 2019505643, shiftBits: 15, mixOp: 'xor' }
  },
  dsp_fft_spectral: {
    fileName: 'dsp_fft_spectral.wasm',
    label: 'Signal & Audio DSP — Fast Spectral Butterfly Kernel',
    spec: { iterations: 180000, multiplier: 2246822519, addConstant: 3266489917, shiftBits: 13, mixOp: 'add' }
  },
  ai_cosine_similarity: {
    fileName: 'ai_cosine_similarity.wasm',
    label: 'AI Vector Embeddings — High-Dim Dot-Product & Scaling',
    spec: { iterations: 200000, multiplier: 374761393, addConstant: 668265263, shiftBits: 9, mixOp: 'mul' }
  },
  physics_verlet_sim: {
    fileName: 'physics_verlet_sim.wasm',
    label: 'Physics & Robotics — Verlet Particle Collision Solver',
    spec: { iterations: 150000, multiplier: 1103515245, addConstant: 12345, shiftBits: 16, mixOp: 'xor' }
  }
};

function buildHashProbeFrame(
  wasmSha256Hex: string,
  seed: number,
  param: number,
  rangeStart: number,
  rangeEnd: number,
  enablePruning: boolean,
  isHealingReroute: boolean,
  inputVector: number[]
): Buffer {
  const buf = Buffer.alloc(69);
  buf.write('NEXH', 0, 4, 'ascii');
  Buffer.from(wasmSha256Hex, 'hex').copy(buf, 4);
  buf.writeUInt32BE(seed >>> 0, 36);
  buf.writeUInt32BE(param >>> 0, 40);
  buf.writeUInt32BE(rangeStart >>> 0, 44);
  buf.writeUInt32BE(rangeEnd >>> 0, 48);
  const flags = (enablePruning ? 0x01 : 0x00) | (isHealingReroute ? 0x02 : 0x00);
  buf.writeUInt8(flags, 52);
  for (let i = 0; i < 4; i++) {
    buf.writeUInt32BE((inputVector[i] || 0) >>> 0, 53 + i * 4);
  }
  return buf;
}

function buildSingleFrame(
  seed: number,
  param: number,
  rangeStart: number,
  rangeEnd: number,
  enablePruning: boolean,
  isHealingReroute: boolean,
  inputVector: number[],
  wasmBuffer: Buffer
): Buffer {
  const taskHeader = Buffer.alloc(32);
  taskHeader.writeUInt32BE(seed >>> 0, 0);
  taskHeader.writeUInt32BE(param >>> 0, 4);
  taskHeader.writeUInt32BE(rangeStart >>> 0, 8);
  taskHeader.writeUInt32BE(rangeEnd >>> 0, 12);
  for (let i = 0; i < 4; i++) {
    taskHeader.writeUInt32BE((inputVector[i] || 0) >>> 0, 16 + i * 4);
  }

  const flags = (enablePruning ? 0x01 : 0x00) | (isHealingReroute ? 0x02 : 0x00);
  const frameHeader = Buffer.alloc(8);
  frameHeader.writeUInt32BE(0x4E455855, 0);
  frameHeader.writeUInt8(0x02, 4);
  frameHeader.writeUInt8(flags, 5);
  frameHeader.writeUInt16BE(wasmBuffer.length, 6);

  const signature64 = crypto
    .createHash('sha512')
    .update(Buffer.concat([frameHeader, taskHeader, wasmBuffer]))
    .digest();

  return Buffer.concat([frameHeader, signature64, taskHeader, wasmBuffer]);
}

function buildMultiChunkFrames(
  seed: number,
  param: number,
  rangeStart: number,
  rangeEnd: number,
  enablePruning: boolean,
  isHealingReroute: boolean,
  inputVector: number[],
  wasmBuffer: Buffer
): Buffer[] {
  if (wasmBuffer.length <= 1400) {
    return [buildSingleFrame(seed, param, rangeStart, rangeEnd, enablePruning, isHealingReroute, inputVector, wasmBuffer)];
  }

  const taskId = crypto.randomInt(100000, 999999999);
  const totalChunks = Math.ceil(wasmBuffer.length / SAFE_UDP_CHUNK_BYTES);
  const frames: Buffer[] = [];
  const flags = (enablePruning ? 0x01 : 0x00) | (isHealingReroute ? 0x02 : 0x00);

  for (let idx = 0; idx < totalChunks; idx++) {
    const slice = wasmBuffer.subarray(idx * SAFE_UDP_CHUNK_BYTES, (idx + 1) * SAFE_UDP_CHUNK_BYTES);
    const header = Buffer.alloc(45);
    header.write('NEXC', 0, 4, 'ascii');
    header.writeUInt32BE(taskId >>> 0, 4);
    header.writeUInt16BE(idx, 8);
    header.writeUInt16BE(totalChunks, 10);
    header.writeUInt32BE(seed >>> 0, 12);
    header.writeUInt32BE(param >>> 0, 16);
    header.writeUInt32BE(rangeStart >>> 0, 20);
    header.writeUInt32BE(rangeEnd >>> 0, 24);
    header.writeUInt8(flags, 28);
    for (let i = 0; i < 4; i++) {
      header.writeUInt32BE((inputVector[i] || 0) >>> 0, 29 + i * 4);
    }
    frames.push(Buffer.concat([header, slice]));
  }
  return frames;
}

function dispatchSmartToMiner(
  port: number,
  host: string,
  pubKeyHex: string | undefined,
  hashFrame: Buffer,
  fallbackFrames: () => Buffer[],
  seed: number,
  param: number,
  slaTimeoutMs: number = 60000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`Gas Execution Timeout (${slaTimeoutMs}ms) on Node ${host}:${port}`));
    }, slaTimeoutMs);

    const sendFullFrames = () => {
      const frames = fallbackFrames();
      let i = 0;
      const sendNext = () => {
        if (i >= frames.length) return;
        const frame = frames[i++];
        socket.send(frame, port, host, (err) => {
          if (err) {
            clearTimeout(timer);
            try { socket.close(); } catch {}
            reject(err);
            return;
          }
          if (i < frames.length) setImmediate(sendNext);
        });
      };
      sendNext();
    };

    socket.on('message', (msg) => {
      if (msg.length === 4 && msg.toString('ascii') === 'MISS') {
        sendFullFrames();
        return;
      }

      clearTimeout(timer);
      try { socket.close(); } catch {}

      if (msg.length === 108 && msg.subarray(0, 4).toString('ascii') === 'NACK') {
        const nodePort = msg.readUInt32BE(4);
        const output = msg.readUInt32BE(8);
        const effectiveShards = msg.readUInt32BE(12);
        const cacheHitOrPruned = msg.readUInt32BE(16);
        const computeTimeUs = msg.readUInt32BE(20);
        const mopsPerSec = msg.readUInt32BE(24);
        const minerVectorOut = [
          msg.readUInt32BE(28),
          msg.readUInt32BE(32),
          msg.readUInt32BE(36),
          msg.readUInt32BE(40)
        ];

        let ed25519Verified = false;
        let sigHex = 'none';
        if (pubKeyHex) {
          try {
            const header44 = msg.subarray(0, 44);
            const sig64 = msg.subarray(44, 108);
            sigHex = sig64.toString('hex').substring(0, 16);
            const pubKeyObj = crypto.createPublicKey({
              key: Buffer.from(pubKeyHex, 'hex'),
              format: 'der',
              type: 'spki'
            });
            ed25519Verified = crypto.verify(null, header44, pubKeyObj, sig64);
          } catch {}
        }

        resolve({
          status: 'ok',
          zeroCopy: true,
          cacheHit: cacheHitOrPruned === 1,
          nodePort,
          host,
          seed,
          param,
          shards: effectiveShards,
          computeTimeUs,
          gops: Number((mopsPerSec / 1000).toFixed(2)),
          minerVectorOut,
          ed25519Verified,
          sigHex,
          computeTimeMs: (computeTimeUs / 1000).toFixed(2),
          results: [{ fn: 'execute_task', output: String(output) }]
        });
        return;
      }

      reject(new Error(`Unexpected packet format (len=${msg.length}) from ${host}:${port}`));
    });

    socket.send(hashFrame, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        reject(err);
      }
    });
  });
}

export async function GET() {
  try {
    const statePath = path.resolve(process.cwd(), 'state.json');
    let blockHistory: any[] = [];
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      blockHistory = state.blockHistory || [];
    }
    return NextResponse.json({
      status: 'ok',
      lanIp: getLocalLanIp(),
      blockHistory
    });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', lanIp: '127.0.0.1', blockHistory: [] });
  }
}

export async function POST(req: Request) {
  try {
    let clientSource = 'WEB_CONSOLE';
    let customWasmBase64: string | null = null;
    let customFileName = '';
    let presetKernelId = 'quant_monte_carlo';
    let studioSpec: any = null;
    let dataVectorStr = '45, 80, 120, 165';
    let batchVectors: number[][] | null = null;
    let totalDagRange = 4;

    try {
      const body = await req.json();
      if (body?.clientSource && typeof body.clientSource === 'string') {
        clientSource = body.clientSource;
      }
      if (body?.wasmBase64 && typeof body.wasmBase64 === 'string') {
        customWasmBase64 = body.wasmBase64;
        customFileName = body.fileName || 'uploaded_custom.wasm';
      }
      if (body?.presetKernelId && typeof body.presetKernelId === 'string') {
        presetKernelId = body.presetKernelId;
      }
      if (body?.studioSpec && typeof body.studioSpec === 'object') {
        studioSpec = body.studioSpec;
      }
      if (body?.dataVectorStr) dataVectorStr = String(body.dataVectorStr);
      if (body?.inputVector && Array.isArray(body.inputVector)) {
        dataVectorStr = body.inputVector.join(', ');
      }
      if (body?.batchVectors && Array.isArray(body.batchVectors) && body.batchVectors.length > 0) {
        batchVectors = body.batchVectors;
      }
      if (body?.totalShards && Number(body.totalShards) >= 1) {
        totalDagRange = Math.min(5000, Number(body.totalShards));
      } else if (body?.shardCalls && Number(body.shardCalls) >= 1) {
        totalDagRange = Math.min(5000, Number(body.shardCalls));
      }
    } catch {}

    const statePath = path.resolve(process.cwd(), 'state.json');

    let wasmBuffer: Buffer;
    let binarySourceOrigin = '';

    if (studioSpec) {
      wasmBuffer = buildCustomWasmBinary(studioSpec);
      customFileName = studioSpec.customName || 'studio_compiled_kernel.wasm';
      binarySourceOrigin = `IN-PLATFORM WASM STUDIO COMPILED (${wasmBuffer.length} Bytes)`;
    } else if (customWasmBase64) {
      wasmBuffer = Buffer.from(customWasmBase64, 'base64');
      binarySourceOrigin = `USER UPLOADED BINARY (${customFileName}, ${wasmBuffer.length} Bytes)`;
    } else if (PRESET_KERNELS[presetKernelId]) {
      const preset = PRESET_KERNELS[presetKernelId];
      wasmBuffer = buildCustomWasmBinary(preset.spec);
      customFileName = preset.fileName;
      binarySourceOrigin = `${preset.label} (${wasmBuffer.length} Bytes)`;
    } else {
      const fallback = PRESET_KERNELS.quant_monte_carlo;
      wasmBuffer = buildCustomWasmBinary(fallback.spec);
      customFileName = fallback.fileName;
      binarySourceOrigin = `${fallback.label} (${wasmBuffer.length} Bytes)`;
    }

    const loopAudit = scanWasmForUnconditionalInfiniteLoops(wasmBuffer);
    if (!loopAudit.safe) {
      return NextResponse.json(
        {
          status: 'error',
          error: loopAudit.reason,
          loopAudit
        },
        { status: 400 }
      );
    }

    let discoveredMap = await probeLiveNodesWithNcip();
    let allLivePorts = Object.keys(discoveredMap).map(Number).sort();
    if (allLivePorts.length < 3) {
      const minerScript = path.resolve(process.cwd(), '../../tools/miner_node.js');
      if (fs.existsSync(minerScript)) {
        for (const p of [6969, 6970, 6971]) {
          if (!allLivePorts.includes(p)) {
            const child = spawn('node', [minerScript, String(p)], {
              detached: true,
              stdio: 'ignore',
              cwd: path.resolve(process.cwd(), '../..')
            });
            child.unref();
          }
        }
        await new Promise(r => setTimeout(r, 1200));
        discoveredMap = await probeLiveNodesWithNcip();
        allLivePorts = Object.keys(discoveredMap).map(Number).sort();
      }
    }

    if (allLivePorts.length === 0) {
      return NextResponse.json(
        { error: "0 Worker Nodes Online! Start M4 miner nodes on ports 6969, 6970, 6971." },
        { status: 503 }
      );
    }

    const parsedInputVec = dataVectorStr
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));
    const inputVector = [
      parsedInputVec[0] ?? 45,
      parsedInputVec[1] ?? 80,
      parsedInputVec[2] ?? 120,
      parsedInputVec[3] ?? 165
    ];

    // If user passed >4 numbers in inputVector (e.g. from CLI/Python SDK) without batchVectors, auto-slice into batch partitions
    if (!batchVectors && parsedInputVec.length > 4) {
      batchVectors = [];
      for (let i = 0; i < parsedInputVec.length; i += 4) {
        batchVectors.push([
          parsedInputVec[i] ?? 45,
          parsedInputVec[(i + 1) % parsedInputVec.length] ?? 80,
          parsedInputVec[(i + 2) % parsedInputVec.length] ?? 120,
          parsedInputVec[(i + 3) % parsedInputVec.length] ?? 165
        ]);
      }
    }

    const wasmSha256 = crypto.createHash('sha256').update(wasmBuffer).digest('hex');
    let cacheRecord = gatewayWasmCache.get(wasmSha256);
    if (!cacheRecord) {
      const compiledMod = await WebAssembly.compile(new Uint8Array(wasmBuffer));
      cacheRecord = { module: compiledMod, expectedMap: new Map() };
      gatewayWasmCache.set(wasmSha256, cacheRecord);
    }

    const verifyModule = cacheRecord.module;
    const exportedItems = WebAssembly.Module.exports(verifyModule);
    const importedItems = WebAssembly.Module.imports(verifyModule);
    const exportedFns = exportedItems.filter((e) => e.kind === 'function');
    if (exportedFns.length === 0) {
      return NextResponse.json({ error: "WASM binary has 0 exported functions!" }, { status: 400 });
    }
    const primaryFnName = exportedFns[0].name;

    const complexity = Math.max(10, Math.round(wasmBuffer.length / 10));
    const candidateNodesAudit: any[] = [];
    let totalScore = 0;

    for (const port of allLivePorts) {
      const ncip = discoveredMap[port];
      const host = ncip.host || '127.0.0.1';
      const cores = ncip.cores || 8;
      const thermal = ncip.thermal ?? 40;
      const rawScore = Math.floor(((cores * 10000) / (thermal + 1)) * (1000 / complexity)) / 100;
      const score = Math.max(10, Number(rawScore.toFixed(2)));
      totalScore += score;

      candidateNodesAudit.push({
        node_did: ncip.did,
        port,
        host,
        pubKeyHex: ncip.pubKeyHex,
        execution_path: ncip.executionPath,
        computed_utility: score
      });
    }

    candidateNodesAudit.sort((a, b) => b.computed_utility - a.computed_utility);
    const primaryHeroNode = candidateNodesAudit[0];

    let currentCursor = 0;
    const baseShards = Math.floor(totalDagRange / candidateNodesAudit.length);
    let remainder = totalDagRange % candidateNodesAudit.length;
    const nodeAllocations = candidateNodesAudit.map((c) => {
      const span = Math.max(1, baseShards + (remainder > 0 ? (remainder--, 1) : 0));
      const rangeStart = currentCursor;
      const rangeEnd = Math.min(totalDagRange, currentCursor + span);
      currentCursor = rangeEnd;
      const actualSpan = Math.max(1, rangeEnd - rangeStart);
      const actualPct = Math.round((actualSpan / totalDagRange) * 100);
      return { ...c, allocationPct: `${actualPct}%`, rangeStart, rangeEnd: rangeStart + actualSpan, assignedShards: actualSpan };
    });

    const gasSlaTimeoutMs = wasmBuffer.length > 1000000 ? 65000 : 25000;

    const swarmStartMs = performance.now();
    const shardPromises = nodeAllocations.map((alloc) => {
      const nodeSeed = inputVector[alloc.rangeStart % 4];
      const nodeParam = inputVector[(alloc.rangeStart + 1) % 4];
      const hashFrame = buildHashProbeFrame(
        wasmSha256,
        nodeSeed,
        nodeParam,
        alloc.rangeStart,
        alloc.rangeEnd,
        false,
        false,
        inputVector
      );
      const fallbackFrames = () => buildMultiChunkFrames(
        nodeSeed,
        nodeParam,
        alloc.rangeStart,
        alloc.rangeEnd,
        false,
        false,
        inputVector,
        wasmBuffer
      );
      return dispatchSmartToMiner(alloc.port, alloc.host, alloc.pubKeyHex, hashFrame, fallbackFrames, nodeSeed, nodeParam, gasSlaTimeoutMs);
    });

    const nodeResponses = await Promise.all(shardPromises);
    const swarmParallelWallMs = Number((performance.now() - swarmStartMs).toFixed(2));

    const vecKey = inputVector.join(',');
    let baseline = cacheRecord.expectedMap.get(vecKey);
    if (!baseline) {
      const sharedMemory = new WebAssembly.Memory({ initial: 18, maximum: 256 });
      const verifyInstance = await WebAssembly.instantiate(verifyModule, {
        env: { memory: sharedMemory, abort: () => {} }
      });
      const verifyFn = verifyInstance.exports[primaryFnName] as CallableFunction;

      const nativeStartMs = performance.now();
      const nativeExpectedVector: number[] = [];
      for (let i = 0; i < 4; i++) {
        const a = inputVector[i];
        const b = inputVector[(i + 1) % 4];
        try {
          nativeExpectedVector.push(canonicalizeOutput(verifyFn(a, b)));
        } catch {
          nativeExpectedVector.push(canonicalizeOutput(verifyFn()));
        }
      }
      const benchNative4CallsMs = Number((performance.now() - nativeStartMs).toFixed(2));

      const wasmMemObj = (verifyInstance.exports.memory as WebAssembly.Memory) || sharedMemory;
      const memU32 = new Uint32Array(wasmMemObj.buffer);
      const extractedMatrixSample: number[] = [];
      const matrixCStartIdx = 0x30000 >> 2;
      if (memU32.length > matrixCStartIdx + 64 && memU32[matrixCStartIdx] !== 0) {
        for (let i = 0; i < 64; i++) {
          extractedMatrixSample.push(memU32[matrixCStartIdx + i] >>> 0);
        }
      } else {
        for (let i = 0; i < memU32.length && extractedMatrixSample.length < 64; i++) {
          if (memU32[i] !== 0) extractedMatrixSample.push(memU32[i] >>> 0);
        }
      }
      const memPages = wasmMemObj.buffer.byteLength / 65536;
      baseline = {
        vec: nativeExpectedVector,
        matrix: extractedMatrixSample,
        nativeMs: benchNative4CallsMs,
        memPages
      };
      cacheRecord.expectedMap.set(vecKey, baseline);
    }

    let batchResults: { row: number; input: number[]; output: number[]; assignedNode: number }[] = [];
    if (batchVectors && batchVectors.length > 0) {
      const sharedMemory = new WebAssembly.Memory({ initial: 18, maximum: 256 });
      const batchInstance = await WebAssembly.instantiate(verifyModule, {
        env: { memory: sharedMemory, abort: () => {} }
      });
      const batchFn = batchInstance.exports[primaryFnName] as CallableFunction;
      batchResults = batchVectors.slice(0, 100).map((vec, rIdx) => {
        const v = [vec[0] ?? 10, vec[1] ?? 20, vec[2] ?? 30, vec[3] ?? 40];
        const out = [0, 1, 2, 3].map(i => canonicalizeOutput(batchFn(v[i], v[(i + 1) % 4])));
        return {
          row: rIdx + 1,
          input: v,
          output: out,
          assignedNode: allLivePorts[rIdx % allLivePorts.length]
        };
      });
    }

    const { vec: nativeExpectedVector, matrix: extractedMatrixSample, nativeMs: benchNative4CallsMs, memPages } = baseline;
    const anyCacheHit = nodeResponses.some(r => r.cacheHit);
    const udpChunksCount = anyCacheHit
      ? 1
      : (wasmBuffer.length <= 1400 ? 1 : Math.ceil(wasmBuffer.length / SAFE_UDP_CHUNK_BYTES));

    const wasmInspector = {
      fileName: customFileName,
      binaryOrigin: binarySourceOrigin,
      byteSize: wasmBuffer.length,
      sha256: wasmSha256.substring(0, 16),
      cacheStatus: anyCacheHit ? 'NEXH Zero-Copy Hash Hit (1 Frame)' : 'Cold UDP Stream',
      loopSafetyAudit: `Verified Safe (${loopAudit.loopsDetected} bounded loop(s), 0 unconditional infinite loops)`,
      magicHeaderHex: wasmBuffer.subarray(0, 8).toString('hex').toUpperCase(),
      bytecodeHexPreview: wasmBuffer.subarray(0, Math.min(64, wasmBuffer.length)).toString('hex').match(/.{1,2}/g)?.join(' ') || '',
      wasmBase64: wasmBuffer.length <= 65536 ? wasmBuffer.toString('base64') : undefined,
      exportedFunctions: exportedFns.map(f => `${f.name}(seed: i32, param: i32) -> i32`),
      exportedMemory: `${Math.round(memPages * 64)} KB Linear Memory (${memPages} Pages)`,
      importsCount: importedItems.length,
      udpChunksRequired: udpChunksCount
    };

    const commitResult = await withLedgerLock(async () => {
      if (!fs.existsSync(statePath)) {
        fs.writeFileSync(statePath, JSON.stringify(getInitialState(), null, 2));
      }
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

      for (const port of allLivePorts) {
        const pStr = String(port);
        const ncip = discoveredMap[port];
        if (!state.miners[pStr]) {
          state.miners[pStr] = {
            port,
            host: ncip.host || '127.0.0.1',
            did: ncip.did,
            pubKeyHex: ncip.pubKeyHex,
            cpuModel: ncip.cpuModel,
            executionPath: ncip.executionPath,
            wallet: 0,
            staked: 1000,
            trust: 100,
            slashed: false,
            tasksCompleted: 0,
            rescuesCompleted: 0,
            ed25519VerifiedCount: 0,
            gopsThroughput: 0
          };
        } else {
          state.miners[pStr].pubKeyHex = ncip.pubKeyHex || state.miners[pStr].pubKeyHex;
          state.miners[pStr].did = ncip.did || state.miners[pStr].did;
          state.miners[pStr].cpuModel = ncip.cpuModel || state.miners[pStr].cpuModel;
          state.miners[pStr].cores = ncip.cores;
          state.miners[pStr].hostPhysicalCores = ncip.hostPhysicalCores;
          state.miners[pStr].loadAvg1m = ncip.loadAvg1m;
          state.miners[pStr].thermal = ncip.thermal;
          state.miners[pStr].battery = ncip.battery;
          state.miners[pStr].freeRamMb = ncip.freeRamMb;
          state.miners[pStr].latencyMs = ncip.latencyMs;
        }
      }

      const kbSize = wasmBuffer.length / 1024;
      const batchMultiplier = batchResults.length > 0 ? Math.max(1, batchResults.length * 0.25) : 1;
      const baseFee = 0.0060;
      const shardFee = totalDagRange * 0.0020 * batchMultiplier;
      const bandwidthFee = (anyCacheHit ? 0.0005 : Math.min(0.0800, kbSize * 0.000005));
      const memoryFee = memPages * 0.0001;
      const dynamicGasNxc = Number((baseFee + shardFee + bandwidthFee + memoryFee).toFixed(4));

      const scanlineBands: any[] = [];
      const slashedNodes: any[] = [];
      const assembledMinerVector = [...nativeExpectedVector];
      let taskBurnedNxc = 0;
      let taskMinerMintedNxc = 0;
      let runSwarmGops = 0;

      for (const resp of nodeResponses) {
        const portStr = String(resp.nodePort);
        const alloc = nodeAllocations.find((a) => a.port === resp.nodePort);
        const shardWeight = (alloc?.assignedShards || 1) / totalDagRange;

        const grossChunkNxc = Number((dynamicGasNxc * shardWeight).toFixed(4));
        const burnedFee = Number((grossChunkNxc * 0.30).toFixed(4));
        const netMinerReward = Number((grossChunkNxc - burnedFee).toFixed(4));

        const primaryShardIdx = (alloc?.rangeStart || 0) % 4;
        const expectedNum = nativeExpectedVector[primaryShardIdx];
        const reportedNum = canonicalizeOutput(resp.results?.[0]?.output);
        const isHonestMatch = Math.abs(expectedNum - reportedNum) <= 1;

        if (isHonestMatch && resp.ed25519Verified) {
          if (alloc) {
            for (let s = alloc.rangeStart; s < alloc.rangeEnd; s++) {
              const idx4 = s % 4;
              if (resp.minerVectorOut?.[idx4]) {
                assembledMinerVector[idx4] = resp.minerVectorOut[idx4] >>> 0;
              }
            }
          }

          state.miners[portStr].wallet = Number((state.miners[portStr].wallet + netMinerReward).toFixed(4));
          state.miners[portStr].tasksCompleted += (alloc?.assignedShards || 1);
          state.miners[portStr].ed25519VerifiedCount = (state.miners[portStr].ed25519VerifiedCount || 0) + 1;
          state.miners[portStr].gopsThroughput = resp.gops || 1.5;
          state.miners[portStr].lastComputeUs = resp.computeTimeUs;
          runSwarmGops = Number((runSwarmGops + (resp.gops || 1.5)).toFixed(2));
          taskBurnedNxc = Number((taskBurnedNxc + burnedFee).toFixed(4));
          taskMinerMintedNxc = Number((taskMinerMintedNxc + netMinerReward).toFixed(4));

          scanlineBands.push({
            port: resp.nodePort,
            rangeStart: alloc?.rangeStart,
            rangeEnd: alloc?.rangeEnd,
            assignedShards: alloc?.assignedShards,
            allocationPct: alloc?.allocationPct,
            status: 'VERIFIED',
            cacheHit: resp.cacheHit,
            sigHex: resp.sigHex,
            computeTimeUs: resp.computeTimeUs,
            computeTimeMs: resp.computeTimeMs,
            gops: resp.gops,
            rewardNxc: netMinerReward,
            burnedNxc: burnedFee,
            outputVal: reportedNum
          });
        } else {
          const slashPenalty = 250;
          const rescueBounty = 5.0;
          state.miners[portStr].staked = Math.max(0, state.miners[portStr].staked - slashPenalty);
          state.miners[portStr].trust = 0;
          state.miners[portStr].slashed = true;
          taskBurnedNxc = Number((taskBurnedNxc + (slashPenalty - rescueBounty)).toFixed(4));

          slashedNodes.push({
            nodePort: resp.nodePort,
            expected: String(expectedNum),
            reported: String(reportedNum),
            penalty: slashPenalty
          });

          if (primaryHeroNode && primaryHeroNode.port !== resp.nodePort && alloc) {
            const heroPortStr = String(primaryHeroNode.port);
            const rescueHashFrame = buildHashProbeFrame(
              wasmSha256,
              resp.seed,
              resp.param,
              alloc.rangeStart,
              alloc.rangeEnd,
              false,
              true,
              inputVector
            );
            const rescueFallback = () => buildMultiChunkFrames(
              resp.seed,
              resp.param,
              alloc.rangeStart,
              alloc.rangeEnd,
              false,
              true,
              inputVector,
              wasmBuffer
            );
            const rescueResp = await dispatchSmartToMiner(
              primaryHeroNode.port,
              primaryHeroNode.host,
              primaryHeroNode.pubKeyHex,
              rescueHashFrame,
              rescueFallback,
              resp.seed,
              resp.param,
              gasSlaTimeoutMs
            );
            const rescueReported = canonicalizeOutput(rescueResp.results?.[0]?.output);

            if (Math.abs(expectedNum - rescueReported) <= 1 && rescueResp.ed25519Verified) {
              const totalHeroReward = Number((netMinerReward + rescueBounty).toFixed(4));
              state.miners[heroPortStr].wallet = Number((state.miners[heroPortStr].wallet + totalHeroReward).toFixed(4));
              state.miners[heroPortStr].rescuesCompleted = (state.miners[heroPortStr].rescuesCompleted || 0) + 1;
              state.miners[heroPortStr].ed25519VerifiedCount = (state.miners[heroPortStr].ed25519VerifiedCount || 0) + 1;
              taskMinerMintedNxc = Number((taskMinerMintedNxc + totalHeroReward).toFixed(4));

              scanlineBands.push({
                port: primaryHeroNode.port,
                rescuedFrom: resp.nodePort,
                rangeStart: alloc.rangeStart,
                rangeEnd: alloc.rangeEnd,
                assignedShards: alloc.assignedShards,
                allocationPct: alloc.allocationPct,
                status: 'RESCUED_BY_HERO',
                cacheHit: rescueResp.cacheHit,
                sigHex: rescueResp.sigHex,
                computeTimeUs: rescueResp.computeTimeUs,
                computeTimeMs: rescueResp.computeTimeMs,
                gops: rescueResp.gops,
                rewardNxc: totalHeroReward,
                burnedNxc: burnedFee,
                outputVal: rescueReported
              });
            }
          }
        }
      }

      const exactWalletDeduction = Number((taskBurnedNxc + taskMinerMintedNxc).toFixed(4));
      state.clientWallet = Number((state.clientWallet - exactWalletDeduction).toFixed(4));
      state.totalBurned = Number(((state.totalBurned || 0) + taskBurnedNxc).toFixed(4));
      state.circulatingSupply = Number(((state.genesisSupply || 21000000) - state.totalBurned).toFixed(4));
      state.nxcUsdPrice = Number((2.50 + (state.totalBurned * 0.12) + (state.blockHeight * 0.0035)).toFixed(4));
      state.prevBlockHash = state.merkleStateSeal || "0".repeat(64);
      state.blockHeight = (state.blockHeight || 1) + 1;
      state.merkleStateSeal = computeStateMerkleSeal(state);

      if (!Array.isArray(state.blockHistory)) state.blockHistory = [];
      state.blockHistory.unshift({
        blockHeight: state.blockHeight,
        timestamp: new Date().toISOString(),
        source: clientSource,
        kernelName: customFileName,
        sha256: wasmSha256.substring(0, 12),
        shards: totalDagRange,
        swarmWallMs: swarmParallelWallMs,
        gops: runSwarmGops,
        gasNxc: exactWalletDeduction,
        burnedNxc: taskBurnedNxc,
        outputVector: assembledMinerVector,
        merkleSeal: state.merkleStateSeal.substring(0, 20)
      });
      if (state.blockHistory.length > 50) state.blockHistory = state.blockHistory.slice(0, 50);

      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

      return {
        blockHeight: state.blockHeight,
        merkleStateSeal: state.merkleStateSeal,
        blockHistory: state.blockHistory,
        assembledMinerVector,
        scanlineBands,
        slashedNodes,
        tokenomicsAudit: {
          totalGasNxc: exactWalletDeduction,
          burnedNxc: taskBurnedNxc,
          minerYieldNxc: taskMinerMintedNxc,
          totalBurnedCumulative: state.totalBurned,
          circulatingSupply: state.circulatingSupply,
          nxcUsdPrice: state.nxcUsdPrice,
          swarmTotalGops: runSwarmGops
        }
      };
    });

    return NextResponse.json({
      status: 'success',
      blockHeight: commitResult.blockHeight,
      merkleStateSeal: commitResult.merkleStateSeal,
      blockHistory: commitResult.blockHistory,
      wasmInspector,
      inputVector,
      batchResults: batchResults.length > 0 ? batchResults : undefined,
      inputCallingConvention: `output[i] = ${primaryFnName}(input[i], input[(i+1)%4])`,
      verifiedMinerOutputVector: commitResult.assembledMinerVector,
      extractedMatrixSample,
      benchNative4CallsMs,
      swarmParallelWallMs,
      scanlineBands: commitResult.scanlineBands,
      slashedNodes: commitResult.slashedNodes,
      tokenomicsAudit: commitResult.tokenomicsAudit
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
