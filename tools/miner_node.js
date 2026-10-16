const dgram = require('dgram');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const PORT = parseInt(process.argv[2] || '6969', 10);
const IS_CORRUPT = process.argv.includes('--corrupt');
const server = dgram.createSocket('udp4');

server.on('message', async (msg, rinfo) => {
  if (msg.toString() === 'PING') {
    const pong = Buffer.from(`PONG:${PORT}`);
    server.send(pong, rinfo.port, rinfo.address);
    return;
  }

  try {
    if (msg.length < 16) return;
    const seed = msg.readUInt32BE(0);
    const param = msg.readUInt32BE(4);
    const shards = msg.readUInt32BE(8);
    const wasmBytes = msg.subarray(12);

    console.log(`\n⚡ [NODE :${PORT}] RX ${wasmBytes.length}B WASM | SEED: #${seed} | PARAM: ${param} | SHARDS: ${shards}`);

    const startTime = performance.now();
    const wasmModule = await WebAssembly.compile(new Uint8Array(wasmBytes));
    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { abort: () => {} }
    });

    const exportedFns = WebAssembly.Module.exports(wasmModule).filter(e => e.kind === 'function');
    const results = [];

    for (const exp of exportedFns) {
      const fn = instance.exports[exp.name];
      let firstShardOut = 0;
      let lastShardOut = 0;

      for (let s = 0; s < shards; s++) {
        const out = fn(seed + s, param) >>> 0;
        if (s === 0) firstShardOut = out;
        lastShardOut = out;
      }

      // If running in --corrupt mode, tamper with the result to simulate a lying miner!
      if (IS_CORRUPT) {
        lastShardOut = (lastShardOut ^ 0xDEAD1337) >>> 0;
        console.log(`💀 [NODE :${PORT}] CORRUPT MODE ACTIVE: Tampered output to ${lastShardOut}`);
      }

      results.push({
        fn: exp.name,
        firstShardOutput: String(firstShardOut),
        output: String(lastShardOut)
      });
    }

    const computeTimeMs = (performance.now() - startTime).toFixed(2);
    const receiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ port: PORT, seed, param, shards, results }))
      .digest('hex');

    console.log(`✅ [NODE :${PORT}] DONE ${results[0]?.fn}() => ${results[0]?.output} IN ${computeTimeMs}ms`);

    const responsePayload = Buffer.from(JSON.stringify({
      status: 'ok',
      nodePort: PORT,
      seed,
      param,
      shards,
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
  console.log(`🟢 NEXUS MINER NODE LIVE ON UDP 127.0.0.1:${PORT} ${IS_CORRUPT ? '[⚠️ ROGUE/CORRUPT MODE]' : '[🛡️ HONEST MODE]'}`);
  console.log(`========================================================`);
});
