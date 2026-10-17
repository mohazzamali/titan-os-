import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';
import { getInitialState, probeLiveNodesWithNcip } from '../state/route';

const SAFE_UDP_CHUNK_BYTES = 1024; // Problem #1 Fix: Safe below 1500B Ethernet/Wi-Fi MTU

function canonicalizeOutput(val: any): number {
  if (typeof val === 'bigint') return Number(val & 0xffffffffn) >>> 0;
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  if (!Number.isInteger(num)) {
    return Math.round(num * 10000);
  }
  return num >>> 0;
}

function buildSingleFrame(
  seed: number,
  param: number,
  rangeStart: number,
  rangeEnd: number,
  enablePruning: boolean,
  wasmBuffer: Buffer
): Buffer {
  const taskHeader = Buffer.alloc(16);
  taskHeader.writeUInt32BE(seed >>> 0, 0);
  taskHeader.writeUInt32BE(param >>> 0, 4);
  taskHeader.writeUInt32BE(rangeStart >>> 0, 8);
  taskHeader.writeUInt32BE(rangeEnd >>> 0, 12);

  const frameHeader = Buffer.alloc(8);
  frameHeader.writeUInt32BE(0x4E455855, 0); // "NEXU"
  frameHeader.writeUInt8(0x02, 4);
  frameHeader.writeUInt8(enablePruning ? 0x01 : 0x00, 5);
  frameHeader.writeUInt16BE(wasmBuffer.length, 6);

  const signature64 = crypto
    .createHash('sha512')
    .update(Buffer.concat([frameHeader, taskHeader, wasmBuffer]))
    .digest();

  return Buffer.concat([frameHeader, signature64, taskHeader, wasmBuffer]);
}

// Problem #1 Fix: Slice large WASM binaries into MTU-safe "NEXC" UDP chunks
function buildMultiChunkFrames(
  seed: number,
  param: number,
  rangeStart: number,
  rangeEnd: number,
  enablePruning: boolean,
  wasmBuffer: Buffer
): Buffer[] {
  if (wasmBuffer.length <= SAFE_UDP_CHUNK_BYTES) {
    return [buildSingleFrame(seed, param, rangeStart, rangeEnd, enablePruning, wasmBuffer)];
  }

  const taskId = crypto.randomInt(100000, 999999999);
  const totalChunks = Math.ceil(wasmBuffer.length / SAFE_UDP_CHUNK_BYTES);
  const frames: Buffer[] = [];

  for (let idx = 0; idx < totalChunks; idx++) {
    const slice = wasmBuffer.subarray(idx * SAFE_UDP_CHUNK_BYTES, (idx + 1) * SAFE_UDP_CHUNK_BYTES);
    const header = Buffer.alloc(29);
    header.write('NEXC', 0, 4, 'ascii');
    header.writeUInt32BE(taskId >>> 0, 4);
    header.writeUInt16BE(idx, 8);
    header.writeUInt16BE(totalChunks, 10);
    header.writeUInt32BE(seed >>> 0, 12);
    header.writeUInt32BE(param >>> 0, 16);
    header.writeUInt32BE(rangeStart >>> 0, 20);
    header.writeUInt32BE(rangeEnd >>> 0, 24);
    header.writeUInt8(enablePruning ? 0x01 : 0x00, 28);
    frames.push(Buffer.concat([header, slice]));
  }
  return frames;
}

// Problem #4 Fix: Send UDP frames to actual Miner Host IP (alloc.host), not hardcoded 127.0.0.1!
function dispatchFramesToMiner(
  port: number,
  host: string,
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

      if (msg.length >= 24 && msg.subarray(0, 4).toString('ascii') === 'NACK') {
        const nodePort = msg.readUInt32BE(4);
        const output = msg.readUInt32BE(8);
        const effectiveShards = msg.readUInt32BE(12);
        const prunedBranches = msg.readUInt32BE(16);
        const computeTimeUs = msg.readUInt32BE(20);
        const chunksReassembled = msg.length >= 28 ? msg.readUInt32BE(24) : 1;
        resolve({
          status: 'ok',
          zeroCopy: true,
          nodePort,
          host,
          seed,
          param,
          shards: effectiveShards,
          prunedBranches,
          chunksReassembled,
          computeTimeMs: (computeTimeUs / 1000).toFixed(2),
          results: [{ fn: 'execute_task', output: String(output) }]
        });
        return;
      }

      try {
        const parsed = JSON.parse(msg.toString());
        resolve({ ...parsed, host, prunedBranches: 0, chunksReassembled: 1 });
      } catch {
        reject(new Error(`Malformed Frame from ${host}:${port}`));
      }
    });

    // Send all chunks sequentially over UDP
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

export async function POST(req: Request) {
  try {
    let customParam: number | null = null;
    let customWasmBase64: string | null = null;
    let customFileName = 'nexus_hybrid_payload.wasm';
    let enablePruning = true;

    try {
      const body = await req.json();
      if (body?.customParam !== undefined && !isNaN(Number(body.customParam))) {
        customParam = Number(body.customParam);
      }
      if (body?.wasmBase64 && typeof body.wasmBase64 === 'string') {
        customWasmBase64 = body.wasmBase64;
        customFileName = body.fileName || 'uploaded_custom.wasm';
      }
      if (body?.enablePruning !== undefined) enablePruning = Boolean(body.enablePruning);
    } catch {}

    const defaultWasmPath = path.resolve(
      process.cwd(),
      '../../nexus-hybrid-payload/target/wasm32-unknown-unknown/release/nexus_hybrid_payload.wasm'
    );
    const statePath = path.resolve(process.cwd(), 'state.json');

    const wasmBuffer = customWasmBase64
      ? Buffer.from(customWasmBase64, 'base64')
      : fs.readFileSync(defaultWasmPath);

    if (!fs.existsSync(statePath)) {
      fs.writeFileSync(statePath, JSON.stringify(getInitialState(), null, 2));
    }
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    const discoveredMap = await probeLiveNodesWithNcip();
    const allLivePorts = Object.keys(discoveredMap).map(Number).sort();

    for (const port of allLivePorts) {
      const pStr = String(port);
      if (!state.miners[pStr]) {
        state.miners[pStr] = {
          port,
          host: discoveredMap[port].host || '127.0.0.1',
          did: discoveredMap[port].did || `did:nexus:node:${port}`,
          executionPath: discoveredMap[port].executionPath || 'PATH-B (OS MicroVM)',
          wallet: 0,
          staked: 1000,
          trust: 100,
          slashed: false,
          tasksCompleted: 0
        };
      }
    }

    const eligiblePorts = allLivePorts.filter((p) => !state.miners[String(p)]?.slashed);

    if (eligiblePorts.length === 0) {
      return NextResponse.json(
        { error: "0 HONEST MINER NODES ONLINE! Start miners or reset slashed state." },
        { status: 503 }
      );
    }

    // Asymmetric Load Balancing Formula: Score = ((Cores * Trust) / (Thermal + 1)) * (1000 / Complexity)
    const complexity = Math.max(10, Math.round(wasmBuffer.length / 10));
    const candidateNodesAudit: any[] = [];
    let totalScore = 0;

    for (const port of eligiblePorts) {
      const ncip = discoveredMap[port];
      const host = ncip.host || '127.0.0.1';
      const cores = ncip.cores || 10;
      const trust = ncip.slaTrust || state.miners[String(port)]?.trust || 98.5;
      const thermal = ncip.thermal ?? 42;
      const battery = ncip.battery ?? 83;

      const numerator = Math.round(cores * trust * 100);
      const denominator = thermal + 1;
      const rawScore = Math.floor((numerator / denominator) * (1000 / complexity)) / 100;
      const score = Math.max(10, Number(rawScore.toFixed(2)));
      totalScore += score;

      state.miners[String(port)].computedUtility = score;
      state.miners[String(port)].host = host;

      candidateNodesAudit.push({
        node_did: ncip.did || `did:nexus:node:${port}`,
        port,
        host,
        execution_path: ncip.executionPath || 'PATH-B',
        computed_utility: score,
        metrics: { cores, trust_pct: trust, thermal_c: thermal, battery_pct: battery, complexity }
      });
    }

    candidateNodesAudit.sort((a, b) => b.computed_utility - a.computed_utility);

    const totalDagRange = 5000;
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

    // TOKENOMICS FIX: USD-Pegged Compute + Fractional Deflationary NXC (Burn-and-Mint Equilibrium)
    // Fair USD price for 5,000 shards = $0.08 USD (AWS costs $0.45 USD -> 82% cheaper for user!)
    // Required NXC = Fair_USD_Cost / Current_NXC_USD_Price
    // As NXC price rises, LESS NXC is needed to do the exact same work!
    const activeLoad = 3;
    const totalCapacity = eligiblePorts.length * 3;
    const surgeMultiplier = Number((1 + Math.pow(activeLoad / totalCapacity, 2) * 0.25).toFixed(2));
    const taskUsdCost = Number(((state.fairTaskUsdCost || 0.08) * surgeMultiplier).toFixed(4));
    const currentNxcPrice = state.nxcUsdPrice || 2.50;
    const totalNxcRequired = Number((taskUsdCost / currentNxcPrice).toFixed(4));

    if (state.clientWallet < totalNxcRequired) {
      return NextResponse.json({ error: "INSUFFICIENT NXC IN CLIENT WALLET" }, { status: 402 });
    }

    const sharedMemory = new WebAssembly.Memory({ initial: 1, maximum: 16 });
    const verifyModule = await WebAssembly.compile(new Uint8Array(wasmBuffer));
    const exportedFns = WebAssembly.Module.exports(verifyModule).filter((e) => e.kind === 'function');
    if (exportedFns.length === 0) {
      return NextResponse.json({ error: "WASM binary has 0 exported functions!" }, { status: 400 });
    }
    const verifyInstance = await WebAssembly.instantiate(verifyModule, {
      env: { memory: sharedMemory, abort: () => {} }
    });
    const primaryFnName = exportedFns[0].name;
    const verifyFn = verifyInstance.exports[primaryFnName] as CallableFunction;

    const baseSeed = crypto.randomInt(10000, 999999);
    const dynamicParam = customParam !== null ? customParam : crypto.randomInt(10, 500);

    const shardPromises = nodeAllocations.map((alloc, idx) => {
      const nodeSeed = baseSeed + idx * 10000;
      const frames = buildMultiChunkFrames(
        nodeSeed,
        dynamicParam,
        alloc.rangeStart,
        alloc.rangeEnd,
        enablePruning,
        wasmBuffer
      );
      return dispatchFramesToMiner(alloc.port, alloc.host, frames, nodeSeed, dynamicParam);
    });

    const nodeResponses = await Promise.all(shardPromises);

    const verifiedNodes: any[] = [];
    const slashedNodes: any[] = [];
    const telemetryLogs: string[] = [];
    let taskBurnedNxc = 0;

    for (const resp of nodeResponses) {
      const portStr = String(resp.nodePort);
      const alloc = nodeAllocations.find((a) => a.port === resp.nodePort);
      const grossChunkNxc = Number((totalNxcRequired * ((alloc?.assignedShards || 1000) / totalDagRange)).toFixed(4));

      // 30% Protocol Burn + 70% Miner Reward
      const burnedFee = Number((grossChunkNxc * 0.30).toFixed(4));
      const netMinerReward = Number((grossChunkNxc - burnedFee).toFixed(4));

      telemetryLogs.push(
        `[SCHEDULER] Routed to ${alloc?.host}:${resp.nodePort} [${alloc?.execution_path}] (${alloc?.allocationPct} | ${resp.chunksReassembled} UDP Frame${resp.chunksReassembled > 1 ? 's' : ''})`
      );

      const lastShardSeed = resp.seed + (resp.shards - 1);
      let rawExpected: any;
      try {
        rawExpected = verifyFn(lastShardSeed, resp.param);
      } catch {
        rawExpected = verifyFn();
      }
      const expectedNum = canonicalizeOutput(rawExpected);
      const reportedNum = canonicalizeOutput(resp.results?.[0]?.output);

      // Problem #5 Fix: Allow <= 1 unit tolerance for quantized float rounding across x86/ARM CPUs
      const isHonestMatch = Math.abs(expectedNum - reportedNum) <= 1;

      if (isHonestMatch) {
        state.miners[portStr].wallet = Number((state.miners[portStr].wallet + netMinerReward).toFixed(4));
        state.miners[portStr].tasksCompleted += 1;
        taskBurnedNxc = Number((taskBurnedNxc + burnedFee).toFixed(4));
        telemetryLogs.push(
          `🏆 [VALID] P${resp.nodePort} verified (${primaryFnName}=${reportedNum}). Miner: +${netMinerReward} NXC ($${(netMinerReward * currentNxcPrice).toFixed(3)}) | 🔥 Burned: ${burnedFee} NXC`
        );
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
        const slashPenalty = 250; // 250 NXC Slashed & Burned
        state.miners[portStr].staked = Math.max(0, state.miners[portStr].staked - slashPenalty);
        state.miners[portStr].trust = 0;
        state.miners[portStr].slashed = true;
        taskBurnedNxc = Number((taskBurnedNxc + slashPenalty).toFixed(4));
        telemetryLogs.push(
          `❌ [BFT SLASH-BURN] Fraud on P${resp.nodePort}! Expected ${expectedNum}, got ${reportedNum}. 🔥 SLASHED & BURNED -${slashPenalty} NXC!`
        );
        slashedNodes.push({
          nodePort: resp.nodePort,
          expected: String(expectedNum),
          reported: String(reportedNum),
          penalty: slashPenalty
        });
      }
    }

    const actualClientNxcCost = Number(verifiedNodes.reduce((acc, n) => acc + n.grossCost, 0).toFixed(4));
    const actualClientUsdPaid = Number((actualClientNxcCost * currentNxcPrice).toFixed(4));
    const awsSaved = Number(Math.max(0, (state.awsEquivalentUsdCost || 0.45) - actualClientUsdPaid).toFixed(4));

    state.clientWallet = Number((state.clientWallet - actualClientNxcCost).toFixed(4));
    state.totalUsdSavedVsAws = Number(((state.totalUsdSavedVsAws || 0) + awsSaved).toFixed(4));
    state.totalBurned = Number(((state.totalBurned || 0) + taskBurnedNxc).toFixed(4));
    state.circulatingSupply = Number(((state.genesisSupply || 21000000) - state.totalBurned).toFixed(4));

    // As NXC is burned, NXC USD price appreciates -> Next task will require EVEN LESS NXC!
    const scarcityBoost = state.totalBurned * 0.012;
    state.nxcUsdPrice = Number((2.50 + scarcityBoost).toFixed(4));
    const nextTaskNxcNeeded = Number(((state.fairTaskUsdCost || 0.08) / state.nxcUsdPrice).toFixed(4));

    telemetryLogs.push(
      `💎 [BME ORACLE] Paid Only ${actualClientNxcCost} NXC ($${actualClientUsdPaid} USD vs $${state.awsEquivalentUsdCost} AWS). NXC Price -> $${state.nxcUsdPrice} (Next Task needs only ~${nextTaskNxcNeeded} NXC!)`
    );

    const schedulerAuditLog = {
      decision_id: `dec_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      udp_chunking_protocol: wasmBuffer.length > SAFE_UDP_CHUNK_BYTES ? "NEXC Multi-Frame" : "NEXU Single-Frame",
      exported_fn_detected: primaryFnName,
      task_usd_cost: `$${actualClientUsdPaid} USD (82% cheaper than AWS)`,
      nxc_spent: `${actualClientNxcCost} NXC`,
      next_task_nxc_estimate: `${nextTaskNxcNeeded} NXC (Less NXC needed as value rises!)`,
      candidate_nodes: nodeAllocations,
      winning_node_did: candidateNodesAudit[0].node_did
    };

    state.lastSchedulerAudit = schedulerAuditLog;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const finalReceiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ schedulerAuditLog, verifiedNodes, slashedNodes }))
      .digest('hex');

    return NextResponse.json({
      status: 'success',
      costNxc: actualClientNxcCost,
      costUsd: actualClientUsdPaid,
      burned: taskBurnedNxc,
      nxcUsdPrice: state.nxcUsdPrice,
      nextTaskNxcNeeded,
      telemetryLogs,
      schedulerAudit: schedulerAuditLog,
      verifiedNodes,
      slashedNodes,
      hashResult: finalReceiptHash
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
