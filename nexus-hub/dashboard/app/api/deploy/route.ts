import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';
import { getInitialState, probeLiveNodesWithNcip, computeStateMerkleSeal } from '../state/route';

const SAFE_UDP_CHUNK_BYTES = 1024;

function synthesizeInstantWasm(mode: string): Buffer {
  let bodyOps: number[];
  if (mode === 'blender_raytrace') {
    bodyOps = [
      0x20, 0x00, 0x41, 0x17, 0x6c,
      0x20, 0x01, 0x41, 0x29, 0x6c, 0x6a,
      0x20, 0x00, 0x41, 0x02, 0x76, 0x73,
      0x41, 0x9d, 0x03, 0x6c, 0x0b
    ];
  } else if (mode === 'ai_tensor_gemm') {
    bodyOps = [
      0x20, 0x00, 0x41, 0x11, 0x6c,
      0x20, 0x01, 0x41, 0x1f, 0x6c, 0x6a,
      0x20, 0x00, 0x41, 0x03, 0x76, 0x73,
      0x41, 0x83, 0x20, 0x6c, 0x0b
    ];
  } else {
    bodyOps = [
      0x20, 0x00, 0x20, 0x01, 0x73,
      0x41, 0x8d, 0x93, 0x65, 0x6c,
      0x20, 0x01, 0x41, 0x03, 0x74, 0x73, 0x0b
    ];
  }

  const funcBody = [0x00, ...bodyOps];
  const codeSectionPayload = [0x01, funcBody.length, ...funcBody];

  return Buffer.from([
    0x00, 0x61, 0x73, 0x6d,
    0x01, 0x00, 0x00, 0x00,
    0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00,
    0x07, 0x10, 0x01, 0x0c,
    0x73, 0x79, 0x6e, 0x74, 0x68, 0x5f, 0x6b, 0x65, 0x72, 0x6e, 0x65, 0x6c,
    0x00, 0x00,
    0x0a, codeSectionPayload.length, ...codeSectionPayload
  ]);
}

function canonicalizeOutput(val: any): number {
  if (typeof val === 'bigint') return Number(val & 0xffffffffn) >>> 0;
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  if (!Number.isInteger(num)) return Math.round(num * 10000);
  return num >>> 0;
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
  if (wasmBuffer.length <= SAFE_UDP_CHUNK_BYTES) {
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

function dispatchFramesToMiner(
  port: number,
  host: string,
  pubKeyHex: string | undefined,
  frames: Buffer[],
  seed: number,
  param: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`UDP SLA Timeout on Miner ${host}:${port}`));
    }, 3000);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}

      if (msg.length === 108 && msg.subarray(0, 4).toString('ascii') === 'NACK') {
        const nodePort = msg.readUInt32BE(4);
        const output = msg.readUInt32BE(8);
        const effectiveShards = msg.readUInt32BE(12);
        const prunedBranches = msg.readUInt32BE(16);
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
          nodePort,
          host,
          seed,
          param,
          shards: effectiveShards,
          prunedBranches,
          computeTimeUs,
          gops: Number((mopsPerSec / 1000).toFixed(2)),
          minerVectorOut,
          ed25519Verified,
          sigHex,
          computeTimeMs: (computeTimeUs / 1000).toFixed(3),
          results: [{ fn: 'execute_task', output: String(output) }]
        });
        return;
      }

      reject(new Error(`Unexpected packet format (len=${msg.length}) from ${host}:${port}`));
    });

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
  });
}

function runRealGradientDescentOnData(targetY: number[], learningRateScale: number, totalShards: number) {
  const X = [1, 2, 3, 4];
  const n = 4;
  const maxVal = Math.max(1, ...targetY.map(v => Math.abs(v)));
  const normY = targetY.map(v => v / maxVal);

  let w = 0.0;
  let b = 0.0;

  let initialMse = 0;
  for (let i = 0; i < n; i++) {
    const err = normY[i] - (w * X[i] + b);
    initialMse += err * err;
  }
  initialMse = initialMse / n;
  const initialLossPct = Number(Math.min(99.9, (initialMse * 100)).toFixed(2));

  const lr = Math.min(0.08, Math.max(0.005, (learningRateScale || 42) / 1000));
  const steps = Math.min(2000, Math.max(50, Math.floor(totalShards / 10)));

  for (let epoch = 0; epoch < steps; epoch++) {
    let dw = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      const pred = w * X[i] + b;
      const diff = pred - normY[i];
      dw += (2 / n) * diff * X[i];
      db += (2 / n) * diff;
    }
    w -= lr * dw;
    b -= lr * db;
  }

  let finalMse = 0;
  for (let i = 0; i < n; i++) {
    const err = normY[i] - (w * X[i] + b);
    finalMse += err * err;
  }
  finalMse = finalMse / n;
  const finalLossPct = Number((finalMse * 100).toFixed(3));
  const accuracyPct = Number(Math.max(0, Math.min(100, 100 - finalLossPct)).toFixed(2));

  const realSlopeW = Number((w * maxVal).toFixed(4));
  const realBiasB = Number((b * maxVal).toFixed(4));
  const nextStep5Prediction = Number((realSlopeW * 5 + realBiasB).toFixed(2));

  return {
    epochsCompleted: steps,
    initialLossPct,
    finalLossPct,
    accuracyPct,
    learnedWeights: {
      w1_slope: realSlopeW,
      bias: realBiasB,
      next_index5_prediction: nextStep5Prediction
    }
  };
}

export async function POST(req: Request) {
  try {
    let customParam: number | null = null;
    let customWasmBase64: string | null = null;
    let customFileName = '';
    let enablePruning = true;
    let synthMode = 'blender_raytrace';
    let dataVectorStr = '45, 80, 120, 165';
    let totalDagRange = 5000;
    let useOnDiskRustDefault = false;

    try {
      const body = await req.json();
      if (body?.customParam !== undefined && !isNaN(Number(body.customParam))) {
        customParam = Number(body.customParam);
      }
      if (body?.wasmBase64 && typeof body.wasmBase64 === 'string') {
        customWasmBase64 = body.wasmBase64;
        customFileName = body.fileName || 'user_uploaded.wasm';
      }
      if (body?.enablePruning !== undefined) enablePruning = Boolean(body.enablePruning);
      if (body?.synthMode) synthMode = body.synthMode;
      if (body?.dataVectorStr) dataVectorStr = String(body.dataVectorStr);
      if (body?.totalShards && Number(body.totalShards) >= 500) {
        totalDagRange = Math.min(50000, Number(body.totalShards));
      }
      if (body?.useOnDiskRustDefault) useOnDiskRustDefault = Boolean(body.useOnDiskRustDefault);
    } catch {}

    const defaultWasmPath = path.resolve(
      process.cwd(),
      '../../nexus-hybrid-payload/target/wasm32-unknown-unknown/release/nexus_hybrid_payload.wasm'
    );
    const statePath = path.resolve(process.cwd(), 'state.json');

    let wasmBuffer: Buffer;
    let binarySourceOrigin = '';

    // Strict Mode-Specific Binary Selection (Only use uploaded file in Mode 4 or if explicitly present)
    if (synthMode === 'rust_matrix') {
      if (customWasmBase64) {
        wasmBuffer = Buffer.from(customWasmBase64, 'base64');
        binarySourceOrigin = `USER UPLOADED FILE (${customFileName})`;
      } else if (useOnDiskRustDefault) {
        wasmBuffer = fs.readFileSync(defaultWasmPath);
        customFileName = 'nexus_hybrid_payload.wasm';
        binarySourceOrigin = 'ON-DISK RUST COMPILED BINARY (822 Bytes)';
      } else {
        return NextResponse.json(
          { error: "Aapne Mode 4 (Custom .WASM Upload) chuna hai par koi .wasm file upload nahi ki! Kripya 'Choose File' se apni .wasm file chunein, ya 'Use On-Disk Rust 822B Binary' tick karein." },
          { status: 400 }
        );
      }
    } else {
      wasmBuffer = synthesizeInstantWasm(synthMode);
      customFileName = `auto_synthesized_${synthMode}.wasm`;
      binarySourceOrigin = `IN-RAM AUTO-SYNTHESIZED BYTECODE (${wasmBuffer.length} Bytes — Built-in Studio Template)`;
    }

    if (!fs.existsSync(statePath)) {
      fs.writeFileSync(statePath, JSON.stringify(getInitialState(), null, 2));
    }
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    const discoveredMap = await probeLiveNodesWithNcip();
    const allLivePorts = Object.keys(discoveredMap).map(Number).sort();

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

    const eligiblePorts = allLivePorts.filter((p) => !state.miners[String(p)]?.slashed);
    if (eligiblePorts.length === 0) {
      return NextResponse.json(
        { error: "0 HONEST MINER NODES ONLINE! Reset Ledger or start miners." },
        { status: 503 }
      );
    }

    const complexity = Math.max(10, Math.round(wasmBuffer.length / 10));
    const candidateNodesAudit: any[] = [];
    let totalScore = 0;

    for (const port of eligiblePorts) {
      const ncip = discoveredMap[port];
      const mState = state.miners[String(port)];
      const host = ncip.host || '127.0.0.1';
      const cores = ncip.cores || 8;
      const trust = mState?.trust ?? 100;
      const thermal = ncip.thermal ?? 40;
      const battery = ncip.battery ?? 100;

      const numerator = Math.round(cores * trust * 100);
      const denominator = thermal + 1;
      const rawScore = Math.floor((numerator / denominator) * (1000 / complexity)) / 100;
      const score = Math.max(10, Number(rawScore.toFixed(2)));
      totalScore += score;

      mState.computedUtility = score;
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
    const nodeAllocations = candidateNodesAudit.map((c, idx) => {
      const pct = Math.round((c.computed_utility / totalScore) * 100);
      const span = idx === candidateNodesAudit.length - 1
        ? totalDagRange - currentCursor
        : Math.max(100, Math.round((c.computed_utility / totalScore) * totalDagRange));
      const rangeStart = currentCursor;
      const rangeEnd = currentCursor + span;
      currentCursor = rangeEnd;
      return { ...c, allocationPct: `${pct}%`, rangeStart, rangeEnd, assignedShards: span };
    });

    const activeLoad = 3;
    const totalCapacity = eligiblePorts.length * 3;
    const surgeMultiplier = Number((1 + Math.pow(activeLoad / totalCapacity, 2) * 0.25).toFixed(2));
    const baseUsdPer1kShards = 0.016;
    const awsUsdPer1kShards = 0.090;
    const dynamicTaskUsdCost = Number(((totalDagRange / 1000) * baseUsdPer1kShards * surgeMultiplier).toFixed(4));
    const dynamicAwsUsdCost = Number(((totalDagRange / 1000) * awsUsdPer1kShards).toFixed(4));
    const currentNxcPrice = state.nxcUsdPrice || 2.50;
    const totalNxcRequired = Number((dynamicTaskUsdCost / currentNxcPrice).toFixed(4));

    if (state.clientWallet < totalNxcRequired) {
      return NextResponse.json({ error: "INSUFFICIENT NXC IN CLIENT WALLET" }, { status: 402 });
    }

    const sharedMemory = new WebAssembly.Memory({ initial: 1, maximum: 16 });
    const verifyModule = await WebAssembly.compile(new Uint8Array(wasmBuffer));
    const exportedItems = WebAssembly.Module.exports(verifyModule);
    const importedItems = WebAssembly.Module.imports(verifyModule);
    const exportedFns = exportedItems.filter((e) => e.kind === 'function');
    if (exportedFns.length === 0) {
      return NextResponse.json({ error: "WASM binary has 0 exported functions!" }, { status: 400 });
    }
    const verifyInstance = await WebAssembly.instantiate(verifyModule, {
      env: { memory: sharedMemory, abort: () => {} }
    });
    const primaryFnName = exportedFns[0].name;
    const verifyFn = verifyInstance.exports[primaryFnName] as CallableFunction;

    const wasmInspector = {
      fileName: customFileName,
      binaryOrigin: binarySourceOrigin,
      byteSize: wasmBuffer.length,
      wasmBase64Download: wasmBuffer.toString('base64'),
      magicHeaderHex: wasmBuffer.subarray(0, 8).toString('hex').toUpperCase(),
      bytecodeHexPreview: wasmBuffer.subarray(0, Math.min(48, wasmBuffer.length)).toString('hex').match(/.{1,2}/g)?.join(' ') || '',
      exportedFunctions: exportedFns.map(f => `${f.name}(seed: i32, param: i32) -> i32`),
      exportedMemory: exportedItems.some(e => e.kind === 'memory') ? 'WASM Linear Memory (64KB Pages)' : 'Shared Host Linear Memory (64KB)',
      importsCount: importedItems.length,
      udpChunksRequired: Math.ceil(wasmBuffer.length / SAFE_UDP_CHUNK_BYTES)
    };

    const baseSeed = crypto.randomInt(10000, 999999);
    const dynamicParam = customParam !== null ? customParam : 42;

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

    const shardPromises = nodeAllocations.map((alloc, idx) => {
      const nodeSeed = baseSeed + idx * 10000;
      const frames = buildMultiChunkFrames(
        nodeSeed,
        dynamicParam,
        alloc.rangeStart,
        alloc.rangeEnd,
        enablePruning,
        false,
        inputVector,
        wasmBuffer
      );
      return dispatchFramesToMiner(alloc.port, alloc.host, alloc.pubKeyHex, frames, nodeSeed, dynamicParam);
    });

    const nodeResponses = await Promise.all(shardPromises);

    const verifiedNodes: any[] = [];
    const slashedNodes: any[] = [];
    const scanlineBands: any[] = [];
    let taskBurnedNxc = 0;
    let runSwarmGops = 0;
    let verifiedMinerVectorOut: number[] = [];

    for (const resp of nodeResponses) {
      const portStr = String(resp.nodePort);
      const alloc = nodeAllocations.find((a) => a.port === resp.nodePort);
      const grossChunkNxc = Number((totalNxcRequired * ((alloc?.assignedShards || 1000) / totalDagRange)).toFixed(4));
      const burnedFee = Number((grossChunkNxc * 0.30).toFixed(4));
      const netMinerReward = Number((grossChunkNxc - burnedFee).toFixed(4));

      const lastShardSeed = resp.seed + (resp.shards - 1);
      let rawExpected: any;
      try {
        rawExpected = verifyFn(lastShardSeed, resp.param);
      } catch {
        rawExpected = verifyFn();
      }
      const expectedNum = canonicalizeOutput(rawExpected);
      const reportedNum = canonicalizeOutput(resp.results?.[0]?.output);

      const expectedVec0 = (() => {
        try { return canonicalizeOutput(verifyFn(resp.seed, inputVector[0])); }
        catch { return canonicalizeOutput(verifyFn()); }
      })();
      const vectorMatch = Math.abs(expectedVec0 - (resp.minerVectorOut?.[0] ?? -999)) <= 1;
      const isHonestMatch = Math.abs(expectedNum - reportedNum) <= 1 && vectorMatch;

      if (isHonestMatch && resp.ed25519Verified) {
        if (verifiedMinerVectorOut.length === 0) {
          verifiedMinerVectorOut = resp.minerVectorOut;
        }
        state.miners[portStr].wallet = Number((state.miners[portStr].wallet + netMinerReward).toFixed(4));
        state.miners[portStr].tasksCompleted += 1;
        state.miners[portStr].ed25519VerifiedCount = (state.miners[portStr].ed25519VerifiedCount || 0) + 1;
        state.miners[portStr].gopsThroughput = resp.gops || 1.5;
        state.miners[portStr].lastComputeUs = resp.computeTimeUs;
        runSwarmGops = Number((runSwarmGops + (resp.gops || 1.5)).toFixed(2));
        taskBurnedNxc = Number((taskBurnedNxc + burnedFee).toFixed(4));

        scanlineBands.push({
          port: resp.nodePort,
          rangeStart: alloc?.rangeStart,
          rangeEnd: alloc?.rangeEnd,
          allocationPct: alloc?.allocationPct,
          status: 'VERIFIED',
          computeTimeUs: resp.computeTimeUs,
          gops: resp.gops
        });

        verifiedNodes.push({
          ...resp,
          verified: true,
          expectedOutput: String(expectedNum),
          allocationPct: alloc?.allocationPct,
          utility: alloc?.computed_utility,
          reward: netMinerReward,
          burned: burnedFee,
          grossCost: grossChunkNxc
        });
      } else {
        const slashPenalty = 250;
        const rescueBounty = 5.0;
        const netSlashBurn = slashPenalty - rescueBounty;

        state.miners[portStr].staked = Math.max(0, state.miners[portStr].staked - slashPenalty);
        state.miners[portStr].trust = 0;
        state.miners[portStr].slashed = true;
        taskBurnedNxc = Number((taskBurnedNxc + netSlashBurn).toFixed(4));

        slashedNodes.push({
          nodePort: resp.nodePort,
          expected: String(expectedNum),
          reported: String(reportedNum),
          rangeStart: alloc?.rangeStart,
          rangeEnd: alloc?.rangeEnd,
          penalty: slashPenalty
        });

        if (primaryHeroNode && primaryHeroNode.port !== resp.nodePort && alloc) {
          const heroPortStr = String(primaryHeroNode.port);
          const rescueFrames = buildMultiChunkFrames(
            resp.seed,
            dynamicParam,
            alloc.rangeStart,
            alloc.rangeEnd,
            enablePruning,
            true,
            inputVector,
            wasmBuffer
          );
          const rescueResp = await dispatchFramesToMiner(
            primaryHeroNode.port,
            primaryHeroNode.host,
            primaryHeroNode.pubKeyHex,
            rescueFrames,
            resp.seed,
            dynamicParam
          );
          const rescueReported = canonicalizeOutput(rescueResp.results?.[0]?.output);

          if (Math.abs(expectedNum - rescueReported) <= 1 && rescueResp.ed25519Verified) {
            if (verifiedMinerVectorOut.length === 0) {
              verifiedMinerVectorOut = rescueResp.minerVectorOut;
            }
            state.miners[heroPortStr].wallet = Number(
              (state.miners[heroPortStr].wallet + netMinerReward + rescueBounty).toFixed(4)
            );
            state.miners[heroPortStr].rescuesCompleted = (state.miners[heroPortStr].rescuesCompleted || 0) + 1;
            state.miners[heroPortStr].ed25519VerifiedCount = (state.miners[heroPortStr].ed25519VerifiedCount || 0) + 1;
            runSwarmGops = Number((runSwarmGops + (rescueResp.gops || 1.5)).toFixed(2));
            taskBurnedNxc = Number((taskBurnedNxc + burnedFee).toFixed(4));

            scanlineBands.push({
              port: primaryHeroNode.port,
              rescuedFrom: resp.nodePort,
              rangeStart: alloc.rangeStart,
              rangeEnd: alloc.rangeEnd,
              allocationPct: alloc.allocationPct,
              status: 'RESCUED_BY_HERO',
              computeTimeUs: rescueResp.computeTimeUs,
              gops: rescueResp.gops
            });

            verifiedNodes.push({
              ...rescueResp,
              verified: true,
              rescuedFrom: resp.nodePort,
              expectedOutput: String(expectedNum),
              reward: netMinerReward + rescueBounty,
              burned: burnedFee,
              grossCost: grossChunkNxc
            });
          }
        }
      }
    }

    // ONLY compute AI Training Summary when actually running AI Mode!
    const aiTrainingSummary = synthMode === 'ai_tensor_gemm'
      ? runRealGradientDescentOnData(inputVector, dynamicParam, totalDagRange)
      : null;

    const actualClientNxcCost = Number(verifiedNodes.reduce((acc, n) => acc + n.grossCost, 0).toFixed(4));
    const actualClientUsdPaid = Number((actualClientNxcCost * currentNxcPrice).toFixed(4));
    const awsSaved = Number(Math.max(0, dynamicAwsUsdCost - actualClientUsdPaid).toFixed(4));

    state.clientWallet = Number((state.clientWallet - actualClientNxcCost).toFixed(4));
    state.totalUsdSavedVsAws = Number(((state.totalUsdSavedVsAws || 0) + awsSaved).toFixed(4));
    state.totalBurned = Number(((state.totalBurned || 0) + taskBurnedNxc).toFixed(4));
    state.circulatingSupply = Number(((state.genesisSupply || 21000000) - state.totalBurned).toFixed(4));
    state.totalSwarmGops = runSwarmGops;

    const scarcityBoost = state.totalBurned * 0.012;
    state.nxcUsdPrice = Number((2.50 + scarcityBoost).toFixed(4));

    state.prevBlockHash = state.merkleStateSeal || "0".repeat(64);
    state.blockHeight = (state.blockHeight || 1) + 1;
    state.merkleStateSeal = computeStateMerkleSeal(state);

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    return NextResponse.json({
      status: 'success',
      executedMode: synthMode,
      blockHeight: state.blockHeight,
      merkleStateSeal: state.merkleStateSeal,
      swarmGops: runSwarmGops,
      wasmInspector,
      scanlineBands,
      aiTrainingSummary,
      inputVector,
      outputVector: verifiedMinerVectorOut,
      costNxc: actualClientNxcCost,
      costUsd: actualClientUsdPaid,
      awsCostUsd: dynamicAwsUsdCost,
      burned: taskBurnedNxc,
      nxcUsdPrice: state.nxcUsdPrice,
      verifiedNodes,
      slashedNodes
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
