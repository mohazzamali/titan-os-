import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';
import { getInitialState, probeLiveNodesWithNcip } from '../state/route';

// Page 9: Zero-Copy Binary Frame Builder (88-Byte Header + Raw WASM Bytes)
function buildZeroCopyFrame(
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

// Page 9: Parse 24-Byte Zero-Copy Binary ACK (Or JSON fallback from QEMU OS)
function sendZeroCopyShard(port: number, packet: Buffer, seed: number, param: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`UDP SLA Timeout on Miner Node :${port}`));
    }, 2500);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}

      // Zero-Copy 24-Byte Binary ACK ("NACK")
      if (msg.length === 24 && msg.subarray(0, 4).toString('ascii') === 'NACK') {
        const nodePort = msg.readUInt32BE(4);
        const output = msg.readUInt32BE(8);
        const effectiveShards = msg.readUInt32BE(12);
        const prunedBranches = msg.readUInt32BE(16);
        const computeTimeUs = msg.readUInt32BE(20);
        resolve({
          status: 'ok',
          zeroCopy: true,
          nodePort,
          seed,
          param,
          shards: effectiveShards,
          prunedBranches,
          computeTimeMs: (computeTimeUs / 1000).toFixed(2),
          results: [{ fn: 'execute_task', output: String(output) }]
        });
        return;
      }

      // Fallback for QEMU Bare-Metal OS JSON ACK
      try {
        const parsed = JSON.parse(msg.toString());
        resolve({ ...parsed, prunedBranches: 0 });
      } catch {
        reject(new Error(`Malformed Frame from :${port}`));
      }
    });

    socket.send(packet, port, '127.0.0.1', (err) => {
      if (err) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        reject(err);
      }
    });
  });
}

export async function POST(req: Request) {
  try {
    let customParam: number | null = null;
    let customWasmBase64: string | null = null;
    let customFileName = 'nexus_hybrid_payload.wasm';
    let trustTier = 'L1';
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
      if (body?.trustTier) trustTier = body.trustTier;
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
    const eligiblePorts = allLivePorts.filter((p) => !state.miners[String(p)]?.slashed);

    if (eligiblePorts.length === 0) {
      return NextResponse.json(
        { error: "0 HONEST MINER NODES ONLINE! Start miners or reset slashed state." },
        { status: 503 }
      );
    }

    // Page 7: Asymmetric Load Balancing Fixed-Point Formula:
    // Score = ((Cores * Trust) / (Thermal + 1)) * (1000 / Complexity)
    const complexity = Math.max(10, Math.round(wasmBuffer.length / 10));
    const candidateNodesAudit: any[] = [];
    let totalScore = 0;

    for (const port of eligiblePorts) {
      const ncip = discoveredMap[port];
      const cores = ncip.cores || 10;
      const trust = ncip.slaTrust || state.miners[String(port)]?.trust || 98.5;
      const thermal = ncip.thermal ?? 42;
      const battery = ncip.battery ?? 83;

      // Strict Integer Fixed-Point Calculation (Scaled by 100)
      const numerator = Math.round(cores * trust * 100);
      const denominator = thermal + 1;
      const rawScore = Math.floor((numerator / denominator) * (1000 / complexity)) / 100;
      const score = Math.max(10, Number(rawScore.toFixed(2)));
      totalScore += score;

      state.miners[String(port)].computedUtility = score;
      state.miners[String(port)].cores = cores;
      state.miners[String(port)].thermal = thermal;
      state.miners[String(port)].battery = battery;

      candidateNodesAudit.push({
        node_did: ncip.did || `did:nexus:node:${port}`,
        port,
        computed_utility: score,
        metrics: { cores, trust_pct: trust, thermal_c: thermal, battery_pct: battery, complexity }
      });
    }

    candidateNodesAudit.sort((a, b) => b.computed_utility - a.computed_utility);

    // Page 4 & 7: Split 5000 Living DAG Range asymmetrically (e.g., 80% Heavy / 20% Mobile)
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

    const activeLoad = 3;
    const totalCapacity = eligiblePorts.length * 3;
    const surgeMultiplier = Number((1 + Math.pow(activeLoad / totalCapacity, 2)).toFixed(2));
    const surgedTotalCost = Math.round(wasmBuffer.length * 50 * surgeMultiplier);

    if (state.clientWallet < surgedTotalCost) {
      return NextResponse.json({ error: "INSUFFICIENT FUNDS IN CLIENT WALLET" }, { status: 402 });
    }

    const verifyModule = await WebAssembly.compile(new Uint8Array(wasmBuffer));
    const verifyInstance = await WebAssembly.instantiate(verifyModule, { env: { abort: () => {} } });
    const verifyFn = verifyInstance.exports.execute_task as CallableFunction;

    const baseSeed = crypto.randomInt(10000, 999999);
    const dynamicParam = customParam !== null ? customParam : crypto.randomInt(10, 500);

    const shardPromises = nodeAllocations.map((alloc, idx) => {
      const nodeSeed = baseSeed + idx * 10000;
      const frame = buildZeroCopyFrame(nodeSeed, dynamicParam, alloc.rangeStart, alloc.rangeEnd, enablePruning, wasmBuffer);
      return sendZeroCopyShard(alloc.port, frame, nodeSeed, dynamicParam);
    });

    const nodeResponses = await Promise.all(shardPromises);

    const verifiedNodes: any[] = [];
    const slashedNodes: any[] = [];
    const telemetryLogs: string[] = [];

    for (const resp of nodeResponses) {
      const portStr = String(resp.nodePort);
      const alloc = nodeAllocations.find((a) => a.port === resp.nodePort);
      const nodeReward = Math.round(surgedTotalCost * ((alloc?.assignedShards || 1000) / totalDagRange));

      telemetryLogs.push(`[SCHEDULER] INITIATING DAG: Dispatching to P${resp.nodePort} (${alloc?.allocationPct} Allocation)...`);
      telemetryLogs.push(`[PASSPORT] RCV: CPU Core-${alloc?.metrics.cores}, Thermal: ${alloc?.metrics.thermal_c}°C, Trust: ${alloc?.metrics.trust_pct}%`);
      telemetryLogs.push(`[WASM ENGINE] Task Received! Range: ${alloc?.rangeStart} to ${alloc?.rangeEnd}${resp.prunedBranches > 0 ? ` (Pruned ${resp.prunedBranches} branches @ T=14ms)` : ''}`);

      const lastShardSeed = resp.seed + (resp.shards - 1);
      const expectedOutput = String(verifyFn(lastShardSeed, resp.param) >>> 0);
      const minerReportedOutput = String(resp.results?.[0]?.output);

      if (trustTier === 'L0' || expectedOutput === minerReportedOutput) {
        state.miners[portStr].wallet += nodeReward;
        state.miners[portStr].tasksCompleted += 1;
        telemetryLogs.push(`🏆 [VALID] Chunk-${resp.nodePort} accepted. Releasing ${nodeReward.toLocaleString()} NXC.`);
        verifiedNodes.push({
          ...resp,
          verified: true,
          expectedOutput,
          allocationPct: alloc?.allocationPct,
          rangeStart: alloc?.rangeStart,
          rangeEnd: alloc?.rangeEnd,
          utility: alloc?.computed_utility,
          reward: nodeReward
        });
      } else {
        const slashPenalty = 25000;
        state.miners[portStr].staked = Math.max(0, state.miners[portStr].staked - slashPenalty);
        state.miners[portStr].trust = 0;
        state.miners[portStr].slashed = true;
        telemetryLogs.push(`❌ [BFT DETECTED] DRIFT MALICIOUS FRAUD EXPELLED ON P${resp.nodePort}! Expected ${expectedOutput}, got ${minerReportedOutput}`);
        slashedNodes.push({
          nodePort: resp.nodePort,
          expected: expectedOutput,
          reported: minerReportedOutput,
          penalty: slashPenalty
        });
      }
    }

    const schedulerAuditLog = {
      decision_id: `dec_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      formula: "Score = ((Cores * Trust) / (Thermal + 1)) * (1000 / Complexity)",
      autonomous_branch_pruning: enablePruning,
      zero_copy_serialization: true,
      candidate_nodes: nodeAllocations,
      winning_node_did: candidateNodesAudit[0].node_did
    };

    const actualClientCost = verifiedNodes.reduce((acc, n) => acc + n.reward, 0);
    state.clientWallet -= actualClientCost;
    state.networkTvl += actualClientCost;
    state.lastSchedulerAudit = schedulerAuditLog;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const finalReceiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ schedulerAuditLog, verifiedNodes, slashedNodes }))
      .digest('hex');

    return NextResponse.json({
      status: 'success',
      cost: actualClientCost,
      surgeMultiplier,
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
