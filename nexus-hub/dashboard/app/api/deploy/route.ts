import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';

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
      } catch (e) {
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

export async function POST() {
  try {
    const wasmPath = path.resolve(
      process.cwd(),
      '../../nexus-hybrid-payload/target/wasm32-unknown-unknown/release/nexus_hybrid_payload.wasm'
    );
    const statePath = path.resolve(process.cwd(), 'state.json');

    if (!fs.existsSync(wasmPath)) {
      return NextResponse.json({ error: "WASM binary not found on disk!" }, { status: 404 });
    }

    // 1. Check how many REAL Miner Nodes are alive on UDP
    const livePorts = await discoverNodes();
    if (livePorts.length === 0) {
      return NextResponse.json(
        { error: "0 MINER NODES ONLINE! Run 'node tools/miner_node.js 6969' in a terminal first." },
        { status: 503 }
      );
    }

    const wasmBuffer = fs.readFileSync(wasmPath);
    const actualBytes = wasmBuffer.length;
    const computeCost = actualBytes * 50;

    let state = { clientWallet: 500000, networkTvl: 9101048, lastDeployBytes: 0 };
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    if (state.clientWallet < computeCost) {
      return NextResponse.json({ error: "INSUFFICIENT FUNDS IN CLIENT WALLET" }, { status: 402 });
    }

    // 2. Split 1000 Shards across all LIVE UDP Miner Nodes
    const baseSeed = crypto.randomInt(10000, 999999);
    const dynamicParam = crypto.randomInt(10, 500);
    const shardsPerNode = Math.floor(1000 / livePorts.length);

    const shardPromises = livePorts.map((port, idx) => {
      const header = Buffer.alloc(12);
      header.writeUInt32BE(baseSeed + idx * 1000, 0);
      header.writeUInt32BE(dynamicParam, 4);
      header.writeUInt32BE(shardsPerNode, 8);
      const packet = Buffer.concat([header, wasmBuffer]);
      return sendShardToMiner(port, packet);
    });

    const nodeResponses = await Promise.all(shardPromises);

    // 3. Verify all nodes succeeded & combine cryptographic receipts
    const finalReceiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(nodeResponses))
      .digest('hex');

    // 4. Deduct Client Wallet & Reward Miner Pool ONLY after real UDP verification
    state.clientWallet -= computeCost;
    state.networkTvl += computeCost;
    state.lastDeployBytes = actualBytes;
    fs.writeFileSync(statePath, JSON.stringify(state));

    return NextResponse.json({
      status: 'success',
      bytes: actualBytes,
      cost: computeCost,
      seedUsed: baseSeed,
      liveNodesUsed: livePorts,
      nodeResponses,
      hashResult: finalReceiptHash
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
