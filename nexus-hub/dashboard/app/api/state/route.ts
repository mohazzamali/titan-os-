import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';

const DEFAULT_PORTS = [6969, 6970, 6971];

// Global UDP NAT Hole-Punch Cache (receives outbound REGISTER_NCIP beacons from any port/Wi-Fi node)
const globalAny = globalThis as any;
if (!globalAny.__nexusNatNodes) {
  globalAny.__nexusNatNodes = {} as Record<number, any>;
  try {
    const beaconServer = dgram.createSocket('udp4');
    beaconServer.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (text.startsWith('REGISTER_NCIP:')) {
        try {
          const parsed = JSON.parse(text.slice(14));
          globalAny.__nexusNatNodes[parsed.port] = {
            ...parsed,
            host: rinfo.address || '127.0.0.1',
            lastSeen: Date.now()
          };
        } catch {}
      }
    });
    beaconServer.on('error', () => {});
    beaconServer.bind(6999, '0.0.0.0');
  } catch {}
}

export interface MinerRecord {
  port: number;
  did: string;
  wallet: number;
  staked: number;
  trust: number;
  slashed: boolean;
  tasksCompleted: number;
  cores?: number;
  thermal?: number;
  battery?: number;
  computedUtility?: number;
}

export function getInitialState() {
  return {
    // High-Value Deflationary Tokenomics (10x more work per NXC!)
    clientWallet: 5000,          // 5,000 High-Value NXC
    genesisSupply: 21000000,     // 21,000,000 Fixed Bitcoin-style Cap
    circulatingSupply: 21000000, // Decreases on every task burn & slash burn!
    totalBurned: 0,              // Cumulative NXC permanently destroyed
    nxcUsdPrice: 2.40,           // Base Price in USD, rises as supply burns & compute volume grows
    networkTvl: 125000,
    lastSchedulerAudit: null as any,
    miners: {
      "6969": { port: 6969, did: "did:nexus:node:6969", wallet: 0, staked: 5000, trust: 100, slashed: false, tasksCompleted: 0 },
      "6970": { port: 6970, did: "did:nexus:node:6970", wallet: 0, staked: 5000, trust: 100, slashed: false, tasksCompleted: 0 },
      "6971": { port: 6971, did: "did:nexus:node:6971", wallet: 0, staked: 5000, trust: 100, slashed: false, tasksCompleted: 0 }
    } as Record<string, MinerRecord>
  };
}

export function probeLiveNodesWithNcip(): Promise<Record<number, any>> {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const discovered: Record<number, any> = {};
    const now = Date.now();

    // 1. Include any node that hole-punched via outbound NAT beacon in the last 6 seconds
    const natNodes = globalAny.__nexusNatNodes || {};
    const candidatePorts = new Set<number>(DEFAULT_PORTS);
    for (const pStr of Object.keys(natNodes)) {
      const p = Number(pStr);
      candidatePorts.add(p);
      if (now - natNodes[p].lastSeen < 6000) {
        discovered[p] = { ...natNodes[p], latencyMs: 1.1 };
      }
    }

    const pingStart = performance.now();
    client.on('message', (msg) => {
      const rttMs = Math.max(0.5, Number((performance.now() - pingStart).toFixed(2)));
      const text = msg.toString();
      if (text.startsWith('PONG:')) {
        try {
          const parsed = JSON.parse(text.slice(5));
          discovered[parsed.port] = { ...parsed, latencyMs: rttMs };
        } catch {
          const port = parseInt(text.slice(5), 10);
          if (!isNaN(port)) {
            discovered[port] = {
              port,
              did: `did:nexus:unikernel:${port}`,
              cores: 16,
              thermal: 38,
              battery: 100,
              slaTrust: 99.9,
              latencyMs: rttMs
            };
          }
        }
      }
    });

    for (const port of candidatePorts) {
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
  if (raw.totalBurned === undefined) {
    const fresh = getInitialState();
    fs.writeFileSync(statePath, JSON.stringify(fresh, null, 2));
    return NextResponse.json({ ...fresh, activeNodes: 0, livePorts: [] });
  }

  const discoveredMap = await probeLiveNodesWithNcip();
  const livePorts = Object.keys(discoveredMap).map(Number).sort();

  for (const port of livePorts) {
    const pStr = String(port);
    const ncip = discoveredMap[port];
    if (!raw.miners[pStr]) {
      raw.miners[pStr] = {
        port,
        did: ncip.did || `did:nexus:node:${port}`,
        wallet: 0,
        staked: 5000,
        trust: 100,
        slashed: false,
        tasksCompleted: 0
      };
    }
    raw.miners[pStr].did = ncip.did || raw.miners[pStr].did;
    raw.miners[pStr].cores = ncip.cores ?? 10;
    raw.miners[pStr].thermal = ncip.thermal ?? 42;
    raw.miners[pStr].battery = ncip.battery ?? 83;
  }

  const eligiblePorts = livePorts.filter((p) => !raw.miners[String(p)]?.slashed);

  return NextResponse.json({
    ...raw,
    activeNodes: eligiblePorts.length,
    livePorts
  });
}

export async function DELETE() {
  const statePath = path.resolve(process.cwd(), 'state.json');
  const fresh = getInitialState();
  fs.writeFileSync(statePath, JSON.stringify(fresh, null, 2));
  return NextResponse.json({ status: 'reset', state: fresh });
}
