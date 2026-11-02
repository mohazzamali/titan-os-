#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const count = Math.max(1, Math.min(50, parseInt(process.argv[2] || '8', 10)));
const basePort = 6969;
const minerScript = path.resolve(__dirname, 'miner_node.js');

console.log('================================================================');
console.log('🌐 NEXUS TITAN SWARM SPAWNER // LAUNCHING ' + count + ' WORKER NODES');
console.log('================================================================');

for (let i = 0; i < count; i++) {
  const port = basePort + i;
  const child = spawn('node', [minerScript, String(port)], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  console.log('⚡ Worker Node #' + (i + 1) + ' booted on UDP 127.0.0.1:' + port);
}
console.log('✅ All ' + count + ' Worker Nodes are live in the dynamic pool!');
