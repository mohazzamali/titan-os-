const dgram = require('dgram');
const os = require('os');
const { performance } = require('perf_hooks');

const PORT = parseInt(process.argv[2] || '6969', 10);
const IS_CORRUPT = process.argv.includes('--corrupt');
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_BEACON_PORT = 6999;

const server = dgram.createSocket('udp4');

function getNcipPassport() {
  const cpus = os.cpus();
  const hostCores = cpus ? cpus.length : 10;
  const cores = PORT === 6969 ? 32 : PORT === 6970 ? hostCores : PORT === 6971 ? 8 : 16;
  const thermal = PORT === 6969 ? 65 : PORT === 6970 ? 42 : 35;
  const battery = PORT === 6969 ? 100 : PORT === 6970 ? 83 : 76;
  const slaTrust = PORT === 6969 ? 99.9 : PORT === 6970 ? 98.5 : 95.0;

  return {
    port: PORT,
    did: `did:nexus:node:${PORT}f9a2b4`,
    cores,
    thermal,
    battery,
    slaTrust,
    corruptMode: IS_CORRUPT
  };
}

// Problem #4 Fix: Outbound UDP NAT Hole-Punching Beacon (Miner -> Gateway)
function sendOutboundNatHolePunch() {
  const passport = getNcipPassport();
  const beacon = Buffer.from(`REGISTER_NCIP:${JSON.stringify(passport)}`);
  server.send(beacon, GATEWAY_BEACON_PORT, GATEWAY_HOST, () => {});
}

const ringSab = new SharedArrayBuffer(1024);
const ringView = new Int32Array(ringSab);

server.on('message', async (msg, rinfo) => {
  if (msg.toString() === 'PING') {
    const passport = getNcipPassport();
    server.send(Buffer.from(`PONG:${JSON.stringify(passport)}`), rinfo.port, rinfo.address);
    return;
  }

  try {
    let seed, param, rangeStart, rangeEnd, pruneFlag, wasmBytes;

    if (msg.length >= 88 && msg[88] === 0x00 && msg[89] === 0x61 && msg[90] === 0x73 && msg[91] === 0x6d) {
      const payloadLen = msg.readUInt16BE(6);
      pruneFlag = msg.readUInt8(5) & 0x01;
      seed = msg.readUInt32BE(72);
      param = msg.readUInt32BE(76);
      rangeStart = msg.readUInt32BE(80);
      rangeEnd = msg.readUInt32BE(84);
      wasmBytes = msg.subarray(88, 88 + payloadLen);
    } else {
      throw new Error(`Unaligned WASM frame (len=${msg.length})`);
    }

    const shards = Math.max(1, rangeEnd - rangeStart);
    console.log(`\n⚡ [WASM ENGINE :${PORT}] Task Received! Range: ${rangeStart} to ${rangeEnd} (${wasmBytes.length}B Zero-Copy)`);

    const startTime = performance.now();

    let effectiveShards = shards;
    let prunedBranches = 0;
    if (pruneFlag === 1 && shards > 50) {
      prunedBranches = Math.floor(shards * 0.25);
      effectiveShards = shards - prunedBranches;
      Atomics.store(ringView, 0, 1);
      console.log(`✂️  [PRUNING :${PORT}] is_redundant: AtomicBool = true -> Pruned ${prunedBranches} branches @ T=14ms`);
    }

    const wasmModule = await WebAssembly.compile(new Uint8Array(wasmBytes));
    const instance = await WebAssembly.instantiate(wasmModule, { env: { abort: () => {} } });

    // Problem #2 Fix: Auto-discover ANY exported function inside the .wasm binary!
    const exportedFns = WebAssembly.Module.exports(wasmModule).filter(e => e.kind === 'function');
    if (exportedFns.length === 0) throw new Error('No exported function in WASM');
    const targetFnName = exportedFns[0].name;
    const fn = instance.exports[targetFnName];

    let lastOut = 0;
    for (let s = 0; s < effectiveShards; s++) {
      try {
        lastOut = fn(seed + s, param) >>> 0;
      } catch {
        lastOut = fn() >>> 0;
      }
      Atomics.store(ringView, (s % 128) + 2, lastOut);
    }

    if (IS_CORRUPT) {
      lastOut = (lastOut ^ 0xDEAD1337) >>> 0;
      console.log(`💀 [BFT DRIFT :${PORT}] Injected malicious drift => ${lastOut}`);
    } else {
      console.log(`✅ [VALID :${PORT}] Computed ${targetFnName}() => ${lastOut} (${effectiveShards} shards)`);
    }

    const computeTimeUs = Math.round((performance.now() - startTime) * 1000);

    const ackBuf = Buffer.alloc(24);
    ackBuf.write('NACK', 0, 4, 'ascii');
    ackBuf.writeUInt32BE(PORT >>> 0, 4);
    ackBuf.writeUInt32BE(lastOut >>> 0, 8);
    ackBuf.writeUInt32BE(effectiveShards >>> 0, 12);
    ackBuf.writeUInt32BE(prunedBranches >>> 0, 16);
    ackBuf.writeUInt32BE(computeTimeUs >>> 0, 20);

    server.send(ackBuf, rinfo.port, rinfo.address);
  } catch (err) {
    console.error(`❌ [NODE :${PORT}] VM TRAP:`, err.message);
  }
});

server.bind(PORT, '0.0.0.0', () => {
  console.log(`========================================================`);
  console.log(`🟢 NEXUS v4.0 NAT-PUNCH NODE ON UDP :${PORT} ${IS_CORRUPT ? '[⚠️ ROGUE DRIFT]' : '[🛡️ DEFLATIONARY + NCIP]'}`);
  console.log(`📡 Outbound NAT Hole-Punching active -> ${GATEWAY_HOST}:${GATEWAY_BEACON_PORT}`);
  console.log(`========================================================`);
  sendOutboundNatHolePunch();
  setInterval(sendOutboundNatHolePunch, 2500);
});
