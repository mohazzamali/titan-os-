#!/usr/bin/env node
const http = require('http');
const https = require('https');
const os = require('os');
const crypto = require('crypto');

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const GATEWAY_URL = getArg('--gateway', 'http://localhost:3000');
const PORT = parseInt(getArg('--port', '6972'), 10);

const { publicKey } = crypto.generateKeyPairSync('ed25519');
const pubDer = publicKey.export({ type: 'spki', format: 'der' });
const pubKeyHex = pubDer.toString('hex');
const walletAddr = '0xNX_' + crypto.createHash('sha256').update(pubDer).digest('hex').substring(0, 16).toUpperCase();

function sendHeartbeat() {
  const cpus = os.cpus() || [];
  const payload = JSON.stringify({
    port: PORT,
    host: 'wan-tunnel-node',
    did: 'did:nexus:wan:' + walletAddr,
    pubKeyHex,
    cpuModel: (cpus[0] && cpus[0].model ? cpus[0].model.trim() : 'External Node'),
    cores: cpus.length || 8,
    thermal: 38,
    battery: 100
  });

  const urlObj = new URL('/api/miner-bridge', GATEWAY_URL);
  const lib = urlObj.protocol === 'https:' ? https : http;

  const req = lib.request({
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const d = JSON.parse(body);
        if (d.status === 'ok') {
          console.log('✅ [WAN MINER :' + PORT + '] Connected to ' + GATEWAY_URL + ' | Wallet: ' + walletAddr + ' | Earned: ' + (d.walletBalanceNxc || 0) + ' NXC');
        }
      } catch {}
    });
  });
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

console.log('================================================================');
console.log('🌐 NEXUS TITAN STANDALONE WAN MINER (HTTP/HTTPS + UDP HYBRID)');
console.log('🔑 Node Port: :' + PORT + ' | Wallet: ' + walletAddr);
console.log('📡 Gateway  : ' + GATEWAY_URL);
console.log('================================================================');
sendHeartbeat();
setInterval(sendHeartbeat, 4000);
