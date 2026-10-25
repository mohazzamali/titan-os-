import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getStatePath() {
  return path.resolve(process.cwd(), 'state.json');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const p = getStatePath();
    if (!fs.existsSync(p)) {
      return NextResponse.json({ status: 'ok' });
    }
    const state = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!state.miners) state.miners = {};

    const portStr = String(body.port || 6972);
    const existing = state.miners[portStr] || {
      port: Number(portStr),
      wallet: 0,
      staked: 1000,
      trust: 100,
      slashed: false,
      tasksCompleted: 0,
      rescuesCompleted: 0,
      ed25519VerifiedCount: 0,
      gopsThroughput: 2.45
    };

    state.miners[portStr] = {
      ...existing,
      port: Number(portStr),
      host: body.host || 'remote-http-node',
      did: body.did || ('did:nexus:http:' + portStr),
      pubKeyHex: body.pubKeyHex,
      cpuModel: body.cpuModel || 'Remote Apple Silicon / x64',
      executionPath: 'HTTP/HTTPS Hybrid WAN Tunnel',
      cores: body.cores || 8,
      thermal: body.thermal || 39,
      battery: body.battery || 100,
      lastSeenMs: Date.now()
    };

    fs.writeFileSync(p, JSON.stringify(state, null, 2));
    return NextResponse.json({
      status: 'ok',
      registeredNode: portStr,
      walletBalanceNxc: state.miners[portStr].wallet
    });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}
