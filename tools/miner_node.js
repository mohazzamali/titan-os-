const dgram = require('dgram');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const PORT = parseInt(process.argv[2] || '6969', 10);
const server = dgram.createSocket('udp4');

server.on('message', async (msg, rinfo) => {
  // 1. Handle Real-Time Heartbeat Ping from Dashboard
  if (msg.toString() === 'PING') {
    const pong = Buffer.from(`PONG:${PORT}`);
    server.send(pong, rinfo.port, rinfo.address);
    return;
  }

  try {
    // 2. Parse Binary Packet Header: [seed (4B), param (4B), shards (4B), ...wasmBytes]
    if (msg.length < 16) return;
    const seed = msg.readUInt32BE(0);
    const param = msg.readUInt32BE(4);
    const shards = msg.readUInt32BE(8);
    const wasmBytes = msg.subarray(12);

    console.log(`\n⚡ [NODE :${PORT}] RECEIVED ${wasmBytes.length} BYTES WASM | SEED: #${seed} | SHARDS: ${shards}`);

    const startTime = performance.now();
    const wasmModule = await WebAssembly.compile(new Uint8Array(wasmBytes));
    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { abort: () => {} }
    });

    const exportedFns = WebAssembly.Module.exports(wasmModule).filter(e => e.kind === 'function');
    const results = [];

    for (const exp of exportedFns) {
      const fn = instance.exports[exp.name];
      let out = 0;
      for (let s = 0; s < shards; s++) {
        try {
          out = fn(seed + s, param);
        } catch {
          out = fn();
        }
      }
      results.push({ fn: exp.name, output: String(out) });
    }

    const computeTimeMs = (performance.now() - startTime).toFixed(2);
    const receiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ port: PORT, seed, param, shards, results }))
      .digest('hex');

    console.log(`✅ [NODE :${PORT}] EXECUTED ${results[0]?.fn}() => ${results[0]?.output} IN ${computeTimeMs}ms`);

    // 3. Send Cryptographic Receipt back to Gateway over UDP
    const responsePayload = Buffer.from(JSON.stringify({
      status: 'ok',
      nodePort: PORT,
      computeTimeMs,
      results,
      receiptHash
    }));

    server.send(responsePayload, rinfo.port, rinfo.address);
  } catch (err) {
    console.error(`❌ [NODE :${PORT}] VM ERROR:`, err.message);
    const errPayload = Buffer.from(JSON.stringify({ status: 'error', nodePort: PORT, error: err.message }));
    server.send(errPayload, rinfo.port, rinfo.address);
  }
});

server.bind(PORT, '127.0.0.1', () => {
  console.log(`========================================================`);
  console.log(`🟢 NEXUS BARE-METAL MINER NODE LIVE ON UDP 127.0.0.1:${PORT}`);
  console.log(`   Waiting for WASM Shards & Heartbeat Pings...`);
  console.log(`========================================================`);
});
