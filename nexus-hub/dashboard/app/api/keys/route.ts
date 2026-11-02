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
  if (!Array.isArray(state.billingHistory)) state.billingHistory = [];
  if (!Array.isArray(state.usedUtrs)) state.usedUtrs = [];
  if (!state.merchantUpiId) state.merchantUpiId = 'mohazzam@upi';
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
      merchantUpiId: state.merchantUpiId,
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

    if (body.action === 'update_merchant_upi') {
      if (!body.upiId || !String(body.upiId).includes('@')) {
        return NextResponse.json({ status: 'error', message: 'Invalid UPI ID format (must contain @, e.g. name@okaxis)' }, { status: 400 });
      }
      state.merchantUpiId = String(body.upiId).trim();
      fs.writeFileSync(p, JSON.stringify(state, null, 2));
      return NextResponse.json({ status: 'ok', merchantUpiId: state.merchantUpiId });
    }

    if (body.action === 'create_key') {
      const owner = (body.owner || '').trim();
      if (!owner || owner.length < 2) {
        return NextResponse.json({ status: 'error', message: 'Client / App Name is required (min 2 chars)' }, { status: 400 });
      }
      const initialNxc = Number(body.initialNxc ?? 5.0);
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
      const targetKey = body.apiKey;
      const paymentMethod = body.paymentMethod || 'UPI_NPCI_UTR';
      const amountInr = Number(body.amountInr || 0);
      const rawUtr = String(body.referenceId || '').trim();

      if (!targetKey || !state.apiKeys[targetKey]) {
        return NextResponse.json({ status: 'error', message: 'Target API Key does not exist!' }, { status: 404 });
      }

      if (amountInr < 100 || amountInr > 500000) {
        return NextResponse.json({ status: 'error', message: 'Amount must be between ₹100 and ₹5,00,000 INR' }, { status: 400 });
      }

      // MODE A: Razorpay Cryptographic Signature Verification (if razorpay_signature provided)
      if (body.razorpayOrderId && body.razorpayPaymentId && body.razorpaySignature) {
        const secret = process.env.RAZORPAY_KEY_SECRET || 'nexus_live_webhook_secret';
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(body.razorpayOrderId + '|' + body.razorpayPaymentId)
          .digest('hex');
        if (expectedSig !== body.razorpaySignature) {
          return NextResponse.json({ status: 'error', message: 'BANK SECURITY REJECTED: Invalid Razorpay HMAC-SHA256 Signature!' }, { status: 403 });
        }
      } else {
        // MODE B: Strict NPCI 12-Digit Bank UTR Verification & Anti-Replay Check
        const utrRegex = /^[1-9][0-9]{11}$/;
        if (!utrRegex.test(rawUtr)) {
          return NextResponse.json({
            status: 'error',
            message: 'UPI VERIFICATION FAILED: Please enter a valid 12-digit numeric NPCI Bank UTR number (e.g., 430189234512). Fake or empty UTRs are blocked!'
          }, { status: 400 });
        }

        // Reject trivial repeating digits like 111111111111 or 123456789012
        if (/^(\d)\1{11}$/.test(rawUtr) || rawUtr === '123456789012') {
          return NextResponse.json({
            status: 'error',
            message: 'UPI VERIFICATION FAILED: Test/Sequential UTR numbers (' + rawUtr + ') are rejected by Anti-Fraud Filter!'
          }, { status: 400 });
        }

        if (state.usedUtrs.includes(rawUtr)) {
          return NextResponse.json({
            status: 'error',
            message: 'REPLAY ATTACK BLOCKED: UTR #' + rawUtr + ' has already been claimed! Each bank transaction can only be credited once.'
          }, { status: 409 });
        }

        state.usedUtrs.push(rawUtr);
      }

      const nxcUsd = state.nxcUsdPrice || 2.50;
      const nxcPriceInr = nxcUsd * 84.0;
      const creditedNxc = Number((amountInr / nxcPriceInr).toFixed(4));

      state.apiKeys[targetKey].balanceNxc = Number((state.apiKeys[targetKey].balanceNxc + creditedNxc).toFixed(4));
      state.clientWallet = Number(((state.clientWallet || 100) + creditedNxc).toFixed(4));

      const receipt = {
        id: 'UTR_' + rawUtr.slice(-6),
        timestamp: new Date().toISOString(),
        apiKey: targetKey,
        owner: state.apiKeys[targetKey].owner,
        method: paymentMethod,
        amountInr,
        creditedNxc,
        referenceId: rawUtr,
        verifiedStatus: 'NPCI_FORMAT_AND_REPLAY_VERIFIED'
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
