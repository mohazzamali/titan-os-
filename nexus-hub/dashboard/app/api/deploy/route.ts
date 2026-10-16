import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';
import { getInitialState } from '../state/route';

const CANDIDATE_PORTS = [6969, 6970, 6971];

function discoverNodes(): Promise<number[]> {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const livePorts: number[] = [];

    client.on('message', (msg) => {
      const text = msg.toString();
      if (text.startsWith('PONG:')) {
        const port = parseInt(text.split(':')[1], 10);
        if (!livePorts.includes(port)) livePorts.push(port);
      }
    });

    for (const port of CANDIDATE_PORTS) {
      client.send(Buffer.from('PING'), port, '127.0.0.1');
    }

    setTimeout(() => {
      try { client.close(); } catch {}
      resolve(livePorts.sort());
    }, 120);
  });
}

function sendShardToMiner(port: number, packet: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`UDP Timeout on Miner Node :${port}`));
    }, 2500);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}
      try {
        resolve(JSON.parse(msg.toString()));
      } catch {
        reject(new Error(`Invalid ACK from Miner :${port}`));
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

    try {
      const body = await req.json();
      if (body?.customParam !== undefined && !isNaN(Number(body.customParam))) {
        customParam = Number(body.customParam);
      }
      if (body?.wasmBase64 && typeof body.wasmBase64 === 'string') {
        customWasmBase64 = body.wasmBase64;
        customFileName = body.fileName || 'uploaded_custom.wasm';
      }
    } catch {}

    const defaultWasmPath = path.resolve(
      process.cwd(),
      '../../nexus-hybrid-payload/target/wasm32-unknown-unknown/release/nexus_hybrid_payload.wasm'
    );
    const statePath = path.resolve(process.cwd(), 'state.json');

    let wasmBuffer: Buffer;
    if (customWasmBase64) {
      wasmBuffer = Buffer.from(customWasmBase64, 'base64');
    } else {
      if (!fs.existsSync(defaultWasmPath)) {
        return NextResponse.json({ error: "Default WASM binary not found on disk!" }, { status: 404 });
      }
      wasmBuffer = fs.readFileSync(defaultWasmPath);
    }

    // Validate WebAssembly Magic Header (\0asm)
    if (
      wasmBuffer.length < 8 ||
      wasmBuffer[0] !== 0x00 ||
      wasmBuffer[1] !== 0x61 ||
      wasmBuffer[2] !== 0x73 ||
      wasmBuffer[3] !== 0x6d
    ) {
      return NextResponse.json({ error: "INVALID WASM BINARY: Missing \\0asm magic header!" }, { status: 400 });
    }

    if (!fs.existsSync(statePath)) {
      fs.writeFileSync(statePath, JSON.stringify(getInitialState(), null, 2));
    }
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    const allLivePorts = await discoverNodes();
    const eligiblePorts = allLivePorts.filter((p) => !state.miners[String(p)]?.slashed);

    if (eligiblePorts.length === 0) {
      return NextResponse.json(
        { error: "0 HONEST MINER NODES ONLINE! Start an unslashed miner or reset slashed state." },
        { status: 503 }
      );
    }

    const actualBytes = wasmBuffer.length;
    const totalComputeCost = actualBytes * 50;

    if (state.clientWallet < totalComputeCost) {
      return NextResponse.json({ error: "INSUFFICIENT FUNDS IN CLIENT WALLET" }, { status: 402 });
    }

    // Compile & Inspect uploaded/default WASM for O(1) Spot-Check Verification
    const verifyModule = await WebAssembly.compile(new Uint8Array(wasmBuffer));
    const exportedFns = WebAssembly.Module.exports(verifyModule).filter((e) => e.kind === 'function');
    if (exportedFns.length === 0) {
      return NextResponse.json({ error: "WASM binary contains 0 exported functions!" }, { status: 400 });
    }

    const verifyInstance = await WebAssembly.instantiate(verifyModule, { env: { abort: () => {} } });
    const primaryFnName = exportedFns[0].name;
    const verifyFn = verifyInstance.exports[primaryFnName] as CallableFunction;

    const baseSeed = crypto.randomInt(10000, 999999);
    const dynamicParam = customParam !== null ? customParam : crypto.randomInt(10, 500);
    const shardsPerNode = Math.floor(1000 / eligiblePorts.length);

    const shardPromises = eligiblePorts.map((port, idx) => {
      const nodeSeed = baseSeed + idx * 1000;
      const header = Buffer.alloc(12);
      header.writeUInt32BE(nodeSeed, 0);
      header.writeUInt32BE(dynamicParam, 4);
      header.writeUInt32BE(shardsPerNode, 8);
      const packet = Buffer.concat([header, wasmBuffer]);
      return sendShardToMiner(port, packet);
    });

    const nodeResponses = await Promise.all(shardPromises);

    const verifiedNodes: any[] = [];
    const slashedNodes: any[] = [];
    const rewardPerHonestNode = Math.floor(totalComputeCost / eligiblePorts.length);

    for (const resp of nodeResponses) {
      const portStr = String(resp.nodePort);
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
        state.miners[portStr].wallet += rewardPerHonestNode;
        state.miners[portStr].tasksCompleted += 1;
        verifiedNodes.push({ ...resp, verified: true, reward: rewardPerHonestNode });
      } else {
        const slashPenalty = 25000;
        state.miners[portStr].staked = Math.max(0, state.miners[portStr].staked - slashPenalty);
        state.miners[portStr].trust = 0;
        state.miners[portStr].slashed = true;
        slashedNodes.push({
          nodePort: resp.nodePort,
          expected: expectedOutput,
          reported: minerReportedOutput,
          penalty: slashPenalty
        });
      }
    }

    const actualClientCost = verifiedNodes.length * rewardPerHonestNode;
    state.clientWallet -= actualClientCost;
    state.networkTvl += actualClientCost;
    state.lastDeployBytes = actualBytes;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    const finalReceiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ fileName: customFileName, verifiedNodes, slashedNodes }))
      .digest('hex');

    return NextResponse.json({
      status: 'success',
      fileName: customFileName,
      exportedFn: primaryFnName,
      bytes: actualBytes,
      cost: actualClientCost,
      paramUsed: dynamicParam,
      seedUsed: baseSeed,
      verifiedNodes,
      slashedNodes,
      hashResult: finalReceiptHash
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
