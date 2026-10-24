#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const hostUrl = getArg('--host', 'http://localhost:3000');
const kernelId = getArg('--kernel', 'quant_monte_carlo');
const wasmPath = getArg('--wasm', null);
const vectorStr = getArg('--vector', '45, 80, 120, 165');
const shards = parseInt(getArg('--shards', '8'), 10);

const payload = {
  clientSource: 'NEXUS_CLI_SDK',
  presetKernelId: kernelId,
  dataVectorStr: vectorStr,
  totalShards: shards
};

if (wasmPath) {
  const absPath = path.resolve(process.cwd(), wasmPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ Error: WASM file not found at ${absPath}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(absPath);
  payload.wasmBase64 = buf.toString('base64');
  payload.fileName = path.basename(absPath);
}

const dataStr = JSON.stringify(payload);
const urlObj = new URL('/api/deploy', hostUrl);

console.log(`================================================================`);
console.log(`🚀 NEXUS TITAN CLI // REMOTE CLUSTER DISPATCHER`);
console.log(`================================================================`);
console.log(`📡 Target Gateway : ${urlObj.href}`);
console.log(`📦 Workload       : ${wasmPath ? payload.fileName : kernelId}`);
console.log(`🔢 Input Vector   : [${vectorStr}] across ${shards} Shards`);
console.log(`----------------------------------------------------------------`);

const req = http.request({
  hostname: urlObj.hostname,
  port: urlObj.port || 3000,
  path: urlObj.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(dataStr)
  },
  timeout: 65000
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const out = JSON.parse(body);
      if (out.status !== 'success') {
        console.error(`❌ Cluster Error:`, out.error || out.message);
        process.exit(1);
      }
      console.log(`✅ STATUS         : VERIFIED ON BLOCK #${out.blockHeight}`);
      console.log(`⏱️  Wall Time      : ${out.swarmParallelWallMs} ms (1-Core Baseline: ${out.benchNative4CallsMs} ms)`);
      console.log(`⚡ Throughput     : ${out.tokenomicsAudit?.swarmTotalGops} GOPS (${out.wasmInspector?.cacheStatus})`);
      console.log(`🛡️  Loop Guard     : ${out.wasmInspector?.loopSafetyAudit}`);
      console.log(`💰 Gas Settlement : ${out.tokenomicsAudit?.totalGasNxc} NXC (Miner Payout: ${out.tokenomicsAudit?.minerYieldNxc} NXC | Burned: ${out.tokenomicsAudit?.burnedNxc} NXC)`);
      console.log(`🔐 Merkle Seal    : 0x${out.merkleStateSeal}`);
      console.log(`🏆 Output Vector  : [${out.verifiedMinerOutputVector?.join(', ')}]`);
      console.log(`----------------------------------------------------------------`);
      console.log(`📊 PER-NODE SHARD ATTESTATION:`);
      (out.scanlineBands || []).forEach(b => {
        console.log(`   • Node :${b.port} | Shards [${b.rangeStart}..${b.rangeEnd}) (${b.allocationPct}) | ${b.computeTimeMs}ms | ${b.gops} GOPS | Out: ${b.outputVal} | +${b.rewardNxc} NXC | ${b.status}`);
      });
      console.log(`================================================================`);
    } catch (e) {
      console.error(`❌ Failed to parse gateway response:`, body.slice(0, 300));
    }
  });
});

req.on('error', (err) => {
  console.error(`❌ Connection failed (${err.message}). Make sure Next.js is running on ${hostUrl}`);
});

req.write(dataStr);
req.end();
