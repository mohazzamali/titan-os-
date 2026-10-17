import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';
import { getInitialState, probeLiveNodesWithNcip } from '../state/route';

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
          did: discoveredMap[port].did || `did:nexus:node:${port}`,
          wallet: 0,
          staked: 5000,
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

    // High-Density Deflationary Pricing: 50x more compute per NXC!
    // Base Fee = 0.25 NXC per byte (822B = ~205 NXC instead of 41,100 NXC!)
    const activeLoad = 3;
    const totalCapacity = eligiblePorts.length * 3;
    const surgeMultiplier = Number((1 + Math.pow(activeLoad / totalCapacity, 2)).toFixed(2));
    const surgedTotalCost = Math.max(10, Math.round(wasmBuffer.length * 0.25 * surgeMultiplier));

    if (state.clientWallet < surgedTotalCost) {
      return NextResponse.json({ error: "INSUFFICIENT HIGH-VALUE NXC IN CLIENT WALLET" }, { status: 402 });
    }

    // Dynamic Exported Function Discovery
    const verifyModule = await WebAssembly.compile(new Uint8Array(wasmBuffer));
    const exportedFns = WebAssembly.Module.exports(verifyModule).filter((e) => e.kind === 'function');
    if (exportedFns.length === 0) {
      return NextResponse.json({ error: "WASM binary has 0 exported functions!" }, { status: 400 });
    }
    const verifyInstance = await WebAssembly.instantiate(verifyModule, { env: { abort: () => {} } });
    const primaryFnName = exportedFns[0].name;
    const verifyFn = verifyInstance.exports[primaryFnName] as CallableFunction;

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
    let taskBurnedNxc = 0;

    for (const resp of nodeResponses) {
      const portStr = String(resp.nodePort);
      const alloc = nodeAllocations.find((a) => a.port === resp.nodePort);
      const grossChunkCost = Math.max(2, Math.round(surgedTotalCost * ((alloc?.assignedShards || 1000) / totalDagRange)));

      // Deflationary Split: 30% Permanently Burned (reduces global supply!), 70% Paid to Honest Miner
      const burnedFee = Math.max(1, Math.round(grossChunkCost * 0.30));
      const netMinerReward = grossChunkCost - burnedFee;

      telemetryLogs.push(`[SCHEDULER] INITIATING DAG: Dispatching to P${resp.nodePort} (${alloc?.allocationPct} Allocation)...`);
      telemetryLogs.push(`[PASSPORT] RCV: CPU Core-${alloc?.metrics.cores}, Thermal: ${alloc?.metrics.thermal_c}°C, Trust: ${alloc?.metrics.trust_pct}%`);
      telemetryLogs.push(`[WASM ENGINE] Executed ${primaryFnName}() Range: ${alloc?.rangeStart}..${alloc?.rangeEnd}${resp.prunedBranches > 0 ? ` (Pruned ${resp.prunedBranches} branches)` : ''}`);

      const lastShardSeed = resp.seed + (resp.shards - 1);
      let expectedVal: number;
      try {
        expectedVal = verifyFn(lastShardSeed, resp.param) >>> 0;
      } catch {
        expectedVal = verifyFn() >>> 0;
      }
      const expectedOutput = String(expectedVal);
      const minerReportedOutput = String(resp.results?.[0]?.output);

      if (expectedOutput === minerReportedOutput) {
        state.miners[portStr].wallet += netMinerReward;
        state.miners[portStr].tasksCompleted += 1;
        taskBurnedNxc += burnedFee;
        telemetryLogs.push(`🏆 [VALID] Chunk-${resp.nodePort} accepted. Miner: +${netMinerReward} NXC | 🔥 Burned: ${burnedFee} NXC`);
        verifiedNodes.push({
          ...resp,
          verified: true,
          expectedOutput,
          allocationPct: alloc?.allocationPct,
          utility: alloc?.computed_utility,
          reward: netMinerReward,
          burned: burnedFee,
          grossCost: grossChunkCost
        });
      } else {
        // Slashed Collateral is ALSO Burned from Circulating Supply!
        const slashPenalty = 2500;
        state.miners[portStr].staked = Math.max(0, state.miners[portStr].staked - slashPenalty);
        state.miners[portStr].trust = 0;
        state.miners[portStr].slashed = true;
        taskBurnedNxc += slashPenalty;
        telemetryLogs.push(`❌ [BFT DETECTED] DRIFT FRAUD ON P${resp.nodePort}! Expected ${expectedOutput}, got ${minerReportedOutput}. 🔥 SLASHED & BURNED -${slashPenalty} NXC!`);
        slashedNodes.push({
          nodePort: resp.nodePort,
          expected: expectedOutput,
          reported: minerReportedOutput,
          penalty: slashPenalty
        });
      }
    }

    const actualClientCost = verifiedNodes.reduce((acc, n) => acc + n.grossCost, 0);
    state.clientWallet -= actualClientCost;
    state.networkTvl += actualClientCost;
    state.totalBurned = (state.totalBurned || 0) + taskBurnedNxc;
    state.circulatingSupply = (state.genesisSupply || 21000000) - state.totalBurned;

    // Deflationary Scarcity Index: As tokens burn & utility volume grows, NXC USD value appreciates
    const burnRatio = state.totalBurned / 50000;
    const utilityBoost = (state.networkTvl - 125000) / 5000;
    state.nxcUsdPrice = Number((2.40 + burnRatio * 1.85 + utilityBoost * 0.45).toFixed(4));

    telemetryLogs.push(`🔥 [DEFLATION ENGINE] ${taskBurnedNxc} NXC Permanently Burned! New NXC Value: $${state.nxcUsdPrice} USD`);

    const schedulerAuditLog = {
      decision_id: `dec_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      formula: "Score = ((Cores * Trust) / (Thermal + 1)) * (1000 / Complexity)",
      deflationary_burn_rate: "30% Protocol Fee Burn + 100% Slash Burn",
      nxc_usd_index: `$${state.nxcUsdPrice}`,
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
      cost: actualClientCost,
      burned: taskBurnedNxc,
      nxcUsdPrice: state.nxcUsdPrice,
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
