import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';

const CANDIDATE_PORTS = [6969, 6970, 6971];

export interface MinerRecord {
  port: number;
  wallet: number;
  staked: number;
  trust: number;
  slashed: boolean;
  tasksCompleted: number;
}

export function getInitialState() {
  return {
    clientWallet: 500000,
    networkTvl: 9101048,
    lastDeployBytes: 0,
    miners: {
      "6969": { port: 6969, wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 },
      "6970": { port: 6970, wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 },
      "6971": { port: 6971, wallet: 0, staked: 50000, trust: 100, slashed: false, tasksCompleted: 0 }
    } as Record<string, MinerRecord>
  };
}

function checkLiveNodes(): Promise<number[]> {
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

  const livePorts = await checkLiveNodes();
  // Filter out slashed nodes from active routing count
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
