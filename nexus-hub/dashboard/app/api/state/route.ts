import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import crypto from 'crypto';

const CANDIDATE_PORTS = [6969, 6970, 6971];

export interface MinerRecord {
  port: number;
  did: string;
  wallet: number;
  staked: number;
  trust: number;
  slashed: boolean;
  tasksCompleted: number;
  cores?: number;
  bandwidthMbps?: number;
  thermalPenalty?: number;
  latencyMs?: number;
  computedUtility?: number;
}

export function getInitialState() {
  return {
    clientWallet: 500000,
    networkTvl: 9101048,
    lastDeployBytes: 0,
    activePin: "4582",
    pinHash: crypto.createHash('sha256').update("4582").digest('hex').substring(0, 16),
    lastSchedulerAudit: null as any,
    miners: {
      "6969": { port: 6969, did: "did:nexus:node_6969", wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 },
      "6970": { port: 6970, did: "did:nexus:node_6970", wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 },
      "6971": { port: 6971, did: "did:nexus:node_6971", wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 }
    } as Record<string, MinerRecord>
  };
}

export function probeLiveNodesWithNcip(): Promise<Record<number, any>> {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const discovered: Record<number, any> = {};
    const pingStart = performance.now();

    client.on('message', (msg) => {
      const rttMs = Math.max(1, Number((performance.now() - pingStart).toFixed(2)));
      const text = msg.toString();
      if (text.startsWith('PONG:')) {
        const payload = text.slice(5);
        try {
          const parsed = JSON.parse(payload);
          discovered[parsed.port] = { ...parsed, latencyMs: rttMs };
        } catch {
          const port = parseInt(payload, 10);
          if (!isNaN(port)) {
            discovered[port] = {
              port,
              did: `did:nexus:unikernel_${port}`,
              cores: 4,
              bandwidthMbps: 1000,
              thermalPenalty: 0.0,
              latencyMs: rttMs
            };
          }
        }
      }
    });

    for (const port of CANDIDATE_PORTS) {
      client.send(Buffer.from('PING'), port, '127.0.0.1');
    }

    setTimeout(() => {
      try { client.close(); } catch {}
      resolve(discovered);
    }, 120);
  });
}

export async function GET() {
  const statePath = path.resolve(process.cwd(), 'state.json');

  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify(getInitialState(), null, 2));
  }

  const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (!raw.miners) {
    const fresh = getInitialState();
    fs.writeFileSync(statePath, JSON.stringify(fresh, null, 2));
    return NextResponse.json({ ...fresh, activeNodes: 0, livePorts: [] });
  }

  const discoveredMap = await probeLiveNodesWithNcip();
  const livePorts = Object.keys(discoveredMap).map(Number).sort();

  for (const port of livePorts) {
    const pStr = String(port);
    const ncip = discoveredMap[port];
    if (raw.miners[pStr]) {
      raw.miners[pStr].did = ncip.did || raw.miners[pStr].did;
      raw.miners[pStr].cores = ncip.cores ?? 8;
      raw.miners[pStr].bandwidthMbps = ncip.bandwidthMbps ?? 500;
      raw.miners[pStr].thermalPenalty = ncip.thermalPenalty ?? 0;
      raw.miners[pStr].latencyMs = ncip.latencyMs ?? 2;
    }
  }

  const eligiblePorts = livePorts.filter((p) => !raw.miners[String(p)]?.slashed);

  return NextResponse.json({
    ...raw,
    activeNodes: eligiblePorts.length,
    livePorts
  });
}

export async function POST(req: Request) {
  const statePath = path.resolve(process.cwd(), 'state.json');
  const body = await req.json();
  const raw = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : getInitialState();

  if (body.pin && String(body.pin).length === 4) {
    raw.activePin = String(body.pin);
    raw.pinHash = crypto.createHash('sha256').update(raw.activePin).digest('hex').substring(0, 16);
    fs.writeFileSync(statePath, JSON.stringify(raw, null, 2));
  }
  return NextResponse.json({ activePin: raw.activePin, pinHash: raw.pinHash });
}

export async function DELETE() {
  const statePath = path.resolve(process.cwd(), 'state.json');
  const fresh = getInitialState();
  fs.writeFileSync(statePath, JSON.stringify(fresh, null, 2));
  return NextResponse.json({ status: 'reset', state: fresh });
}
