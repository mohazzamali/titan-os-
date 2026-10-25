#!/bin/bash
cd "$(dirname "$0")"
echo "=========================================================="
echo "🚀 STARTING NEXUS TITAN DISTRIBUTED COMPUTE PLATFORM"
echo "=========================================================="
kill -9 $(lsof -t -i:3000 -i:6969 -i:6970 -i:6971) 2>/dev/null
rm -rf nexus-hub/dashboard/.next/dev/lock
nohup node tools/miner_node.js 6969 >/dev/null 2>&1 &
nohup node tools/miner_node.js 6970 >/dev/null 2>&1 &
nohup node tools/miner_node.js 6971 >/dev/null 2>&1 &
echo "✅ M4 Worker Nodes Online on UDP :6969, :6970, :6971"
(cd nexus-hub/dashboard && nohup npm run dev >/tmp/nextjs_titan.log 2>&1 &)
echo "⏳ Booting Next.js Console on http://localhost:3000 ..."
sleep 5
echo "✅ Nexus Titan is LIVE at http://localhost:3000"
echo "=========================================================="
