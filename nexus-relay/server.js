const WebSocket = require('ws');
const net = require('net');

// --- 1. WEBSOCKET SERVER (Port 8080) for Web Hub & Tier 2 ---
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
let wsClients = [];

// --- 2. RAW TCP SERVER (Port 8081) for Tier 3 Bare-Metal OS ---
let tcpClients = [];

console.log("==================================================");
console.log(" 🌐 NEXUS MATCHMAKER RELAY ONLINE");
console.log(" 📡 WebSockets: Port 8080 (Web Hub & Tier 2)");
console.log(" 🔌 Raw TCP:    Port 8081 (Bare-Metal Tier 3)");
console.log("==================================================");

// --- WEBSOCKET LOGIC ---
wss.on('connection', (ws) => {
    wsClients.push(ws);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'REGISTER_PROVIDER') {
                ws.isProvider = true;
                console.log(`🟢 [RELAY-WS] Tier 2 Node connected!`);
            }
            else if (data.type === 'DEPLOY_TASK') {
                console.log(`🚀 [RELAY] Broadcasting Task (${data.payload.length} bytes) to ALL tiers...`);
                
                // Broadcast to WebSocket Nodes
                wsClients.forEach(c => {
                    if (c.readyState === WebSocket.OPEN && c.isProvider) {
                        c.send(JSON.stringify({ type: 'EXECUTE_WASM', payload: data.payload }));
                    }
                });

                // Broadcast to Bare-Metal TCP Nodes
                const tcpPayload = JSON.stringify({ type: 'EXECUTE_WASM', payload: data.payload }) + "\n";
                tcpClients.forEach(c => {
                    c.write(tcpPayload);
                });
            }
            else if (data.type === 'COMPUTE_RESULT') {
                console.log(`🎯 [RELAY-WS] Result [${data.result}] received! Forwarding to Buyer...`);
                wsClients.forEach(c => {
                    if (c.readyState === WebSocket.OPEN && !c.isProvider) {
                        c.send(JSON.stringify({ type: 'COMPUTE_RESULT', result: data.result }));
                    }
                });
            }
        } catch (e) {}
    });

    ws.on('close', () => wsClients = wsClients.filter(c => c !== ws));
});

// --- TCP LOGIC (THE BARE-METAL BRIDGE) ---
const tcpServer = net.createServer((socket) => {
    console.log(`🟢 [RELAY-TCP] Tier 3 Bare-Metal Rust OS connected! (${socket.remoteAddress})`);
    tcpClients.push(socket);

    socket.on('data', (data) => {
        try {
            // Read raw bytes from Rust OS and parse it
            const message = data.toString().trim();
            const parsed = JSON.parse(message);
            
            if (parsed.type === 'COMPUTE_RESULT') {
                console.log(`🎯 [RELAY-TCP] Bare-Metal Result [${parsed.result}] received! Forwarding to Buyer...`);
                
                // Forward the Rust OS result back to the Web Dashboard (WebSocket)
                wsClients.forEach(c => {
                    if (c.readyState === WebSocket.OPEN && !c.isProvider) {
                        c.send(JSON.stringify({ type: 'COMPUTE_RESULT', result: parsed.result }));
                    }
                });
            }
        } catch (e) {
            // Ignore corrupted raw packets for now
        }
    });

    socket.on('close', () => {
        tcpClients = tcpClients.filter(c => c !== socket);
        console.log(`🔴 [RELAY-TCP] Tier 3 Node disconnected.`);
    });
    
    socket.on('error', (err) => console.log(`⚠️ [RELAY-TCP] Error: ${err.message}`));
});

tcpServer.listen(8081, () => {
    console.log("[SYS] TCP Bridge active on Port 8081");
});
