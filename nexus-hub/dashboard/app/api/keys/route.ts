import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function getStatePath() {
  return path.resolve(process.cwd(), 'state.json');
}

function loadAndEnsureTenants() {
  const p = getStatePath();
  let state: any = {};
  if (fs.existsSync(p)) {
    state = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  if (!state.apiKeys || typeof state.apiKeys !== 'object') {
    state.apiKeys = {
      'nx_live_master_default99': {
        key: 'nx_live_master_default99',
        owner: 'Master Production App',
        balanceNxc: 100.0,
        totalSpentNxc: 0,
        jobsExecuted: 0,
        createdAt: new Date().toISOString()
      }
    };
  }
  if (!Array.isArray(state.billingHistory)) {
    state.billingHistory = [];
  }
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
  return state;
}

export async function GET() {
  try {
    const state = loadAndEnsureTenants();
    return NextResponse.json({
      status: 'ok',
      apiKeys: Object.values(state.apiKeys),
      billingHistory: state.billingHistory,
      nxcUsdPrice: state.nxcUsdPrice || 2.50,
      inrPerUsd: 84.0
    });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const state = loadAndEnsureTenants();
    const p = getStatePath();

    if (body.action === 'create_key') {
      const owner = (body.owner || 'External Client App').trim();
      const initialNxc = Number(body.initialNxc ?? 25.0);
      const rawRand = crypto.randomBytes(10).toString('hex');
      const newKey = 'nx_live_' + rawRand;

      state.apiKeys[newKey] = {
        key: newKey,
        owner,
        balanceNxc: initialNxc,
        totalSpentNxc: 0,
        jobsExecuted: 0,
        createdAt: new Date().toISOString()
      };

      fs.writeFileSync(p, JSON.stringify(state, null, 2));
      return NextResponse.json({
        status: 'ok',
        createdKey: state.apiKeys[newKey],
        apiKeys: Object.values(state.apiKeys)
      });
    }

    if (body.action === 'topup_wallet') {
      const targetKey = body.apiKey || 'nx_live_master_default99';
      const paymentMethod = body.paymentMethod || 'UPI_INR';
      const amountInr = Number(body.amountInr || 1000);
      const utrOrTx = (body.referenceId || ('UTR' + Date.now())).trim();

      const nxcUsd = state.nxcUsdPrice || 2.50;
      const nxcPriceInr = nxcUsd * 84.0;
      const creditedNxc = Number((amountInr / nxcPriceInr).toFixed(4));

      if (!state.apiKeys[targetKey]) {
        return NextResponse.json({ status: 'error', message: 'API Key not found' }, { status: 404 });
      }

      state.apiKeys[targetKey].balanceNxc = Number((state.apiKeys[targetKey].balanceNxc + creditedNxc).toFixed(4));
      state.clientWallet = Number(((state.clientWallet || 100) + creditedNxc).toFixed(4));

      const receipt = {
        id: 'TX_' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        timestamp: new Date().toISOString(),
        apiKey: targetKey,
        owner: state.apiKeys[targetKey].owner,
        method: paymentMethod,
        amountInr,
        creditedNxc,
        referenceId: utrOrTx
      };
      state.billingHistory.unshift(receipt);

      fs.writeFileSync(p, JSON.stringify(state, null, 2));
      return NextResponse.json({
        status: 'ok',
        receipt,
        apiKeys: Object.values(state.apiKeys),
        billingHistory: state.billingHistory
      });
    }

    return NextResponse.json({ status: 'error', message: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}
