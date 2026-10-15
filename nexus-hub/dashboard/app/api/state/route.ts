import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dgram from 'dgram';

const CANDIDATE_PORTS = [6969, 6970, 6971];

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
    const initialState = {
      clientWallet: 500000,
      networkTvl: 9101048,
      lastDeployBytes: 0
    };
    fs.writeFileSync(statePath, JSON.stringify(initialState));
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const livePorts = await checkLiveNodes();

  return NextResponse.json({
    ...state,
    activeNodes: livePorts.length,
    livePorts
  });
}
