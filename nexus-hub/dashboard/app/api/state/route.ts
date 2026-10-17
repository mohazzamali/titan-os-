import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';
import crypto from 'crypto';

const DEFAULT_PORTS = [6969, 6970, 6971];
const LEDGER_SECRET = 'NEXUS_TITAN_RING0_MERKLE_SEAL_KEY_v7';

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
            host: rinfo.address === '::1' ? '127.0.0.1' : (rinfo.address || '127.0.0.1'),
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
  host: string;
  did: string;
  pubKeyHex?: string;
  executionPath?: string;
  wallet: number;
  staked: number;
  trust: number;
  slashed: boolean;
  tasksCompleted: number;
  rescuesCompleted?: number;
  ed25519VerifiedCount?: number;
  gopsThroughput?: number;
  cores?: number;
  thermal?: number;
  battery?: number;
  computedUtility?: number;
}

export function computeStateMerkleSeal(stateObj: any): string {
  const canonicalPayload = JSON.stringify({
    h: stateObj.blockHeight,
    prev: stateObj.prevBlockHash,
    cw: stateObj.clientWallet,
    burn: stateObj.totalBurned,
    miners: Object.keys(stateObj.miners || {}).sort().map(k => ({
      p: k,
      w: stateObj.miners[k].wallet,
      s: stateObj.miners[k].staked,
      sl: stateObj.miners[k].slashed
    }))
  });
  return crypto.createHmac('sha256', LEDGER_SECRET).update(canonicalPayload).digest('hex');
}

export function getInitialState() {
  const base: any = {
    blockHeight: 1,
    prevBlockHash: "0000000000000000000000000000000000000000000000000000000000000000",
    merkleStateSeal: "",
    tamperAlert: false,
    clientWallet: 100.0,
    genesisSupply: 21000000,
    circulatingSupply: 21000000.0,
    totalBurned: 0.0,
    nxcUsdPrice: 2.50,
    fairTaskUsdCost: 0.08,
    awsEquivalentUsdCost: 0.45,
    totalUsdSavedVsAws: 0.0,
    totalSwarmGops: 0.0,
    networkTvl: 50000.0,
    lastSchedulerAudit: null as any,
    miners: {
      "6969": { port: 6969, host: "127.0.0.1", did: "did:nexus:ed25519:0xNX_6969", executionPath: "PATH-A (Ring-0 Unikernel + SIMD Tensor)", wallet: 0, staked: 1000, trust: 100, slashed: false, tasksCompleted: 0, rescuesCompleted: 0, ed25519VerifiedCount: 0, gopsThroughput: 0 },
      "6970": { port: 6970, host: "127.0.0.1", did: "did:nexus:ed25519:0xNX_6970", executionPath: "PATH-B (OS MicroVM + WebGPU/SIMD)", wallet: 0, staked: 1000, trust: 100, slashed: false, tasksCompleted: 0, rescuesCompleted: 0, ed25519VerifiedCount: 0, gopsThroughput: 0 },
      "6971": { port: 6971, host: "127.0.0.1", did: "did:nexus:ed25519:0xNX_6971", executionPath: "PATH-B (OS MicroVM + WebGPU/SIMD)", wallet: 0, staked: 1000, trust: 100, slashed: false, tasksCompleted: 0, rescuesCompleted: 0, ed25519VerifiedCount: 0, gopsThroughput: 0 }
    } as Record<string, MinerRecord>
  };
  base.merkleStateSeal = computeStateMerkleSeal(base);
  return base;
}

export function probeLiveNodesWithNcip(): Promise<Record<number, any>> {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const discovered: Record<number, any> = {};
    const now = Date.now();

    const natNodes = globalAny.__nexusNatNodes || {};
    const candidateTargets: Array<{ port: number; host: string }> = DEFAULT_PORTS.map(p => ({
      port: p,
      host: natNodes[p]?.host || '127.0.0.1'
    }));

    for (const pStr of Object.keys(natNodes)) {
      const p = Number(pStr);
      const natEntry = natNodes[p];
      if (!candidateTargets.find(t => t.port === p)) {
        candidateTargets.push({ port: p, host: natEntry.host || '127.0.0.1' });
      }
      if (now - natEntry.lastSeen < 6000) {
        discovered[p] = { ...natEntry, latencyMs: 1.1 };
      }
    }

    const pingStart = performance.now();
    client.on('message', (msg, rinfo) => {
      const rttMs = Math.max(0.5, Number((performance.now() - pingStart).toFixed(2)));
      const text = msg.toString();
      const senderHost = rinfo.address === '::1' ? '127.0.0.1' : (rinfo.address || '127.0.0.1');
      if (text.startsWith('PONG:')) {
        try {
          const parsed = JSON.parse(text.slice(5));
          discovered[parsed.port] = { ...parsed, host: senderHost, latencyMs: rttMs };
        } catch {
          const port = parseInt(text.slice(5), 10);
          if (!isNaN(port)) {
            discovered[port] = {
              port,
              host: senderHost,
              did: `did:nexus:unikernel:${port}`,
              executionPath: 'PATH-A (Bare-Metal Ring-0)',
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

    for (const target of candidateTargets) {
      client.send(Buffer.from('PING'), target.port, target.host);
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
  if (raw.totalSwarmGops === undefined) {
    const fresh = getInitialState();
    fs.writeFileSync(statePath, JSON.stringify(fresh, null, 2));
    return NextResponse.json({ ...fresh, activeNodes: 0, livePorts: [] });
  }

  const expectedSeal = computeStateMerkleSeal(raw);
  const tamperDetected = raw.merkleStateSeal !== expectedSeal;

  const discoveredMap = await probeLiveNodesWithNcip();
  const livePorts = Object.keys(discoveredMap).map(Number).sort();

  for (const port of livePorts) {
    const pStr = String(port);
    const ncip = discoveredMap[port];
    if (!raw.miners[pStr]) {
      raw.miners[pStr] = {
        port,
        host: ncip.host || '127.0.0.1',
        did: ncip.did || `did:nexus:node:${port}`,
        pubKeyHex: ncip.pubKeyHex,
        executionPath: ncip.executionPath || 'PATH-B (OS MicroVM)',
        wallet: 0,
        staked: 1000,
        trust: 100,
        slashed: false,
        tasksCompleted: 0,
        rescuesCompleted: 0,
        ed25519VerifiedCount: 0,
        gopsThroughput: 0
      };
    }
    raw.miners[pStr].host = ncip.host || raw.miners[pStr].host || '127.0.0.1';
    raw.miners[pStr].did = ncip.did || raw.miners[pStr].did;
    raw.miners[pStr].pubKeyHex = ncip.pubKeyHex || raw.miners[pStr].pubKeyHex;
    raw.miners[pStr].executionPath = ncip.executionPath || raw.miners[pStr].executionPath;
    raw.miners[pStr].cores = ncip.cores ?? 10;
    raw.miners[pStr].thermal = ncip.thermal ?? 42;
    raw.miners[pStr].battery = ncip.battery ?? 83;
  }

  const eligiblePorts = livePorts.filter((p) => !raw.miners[String(p)]?.slashed);

  return NextResponse.json({
    ...raw,
    tamperAlert: tamperDetected,
    activeNodes: eligiblePorts.length,
    livePorts
  });
}

// FIX #3: Global WAN HTTP Registration Endpoint (Allows internet miners to register over HTTPS)
export async function POST(req: Request) {
  try {
    const passport = await req.json();
    if (passport?.port) {
      globalAny.__nexusNatNodes[passport.port] = {
        ...passport,
        host: passport.host || '127.0.0.1',
        lastSeen: Date.now()
      };
      return NextResponse.json({ status: 'registered_wan_node', port: passport.port });
    }
    return NextResponse.json({ error: 'Invalid NCIP passport' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  const statePath = path.resolve(process.cwd(), 'state.json');
  const fresh = getInitialState();
  fs.writeFileSync(statePath, JSON.stringify(fresh, null, 2));
  return NextResponse.json({ status: 'reset', state: fresh });
}
