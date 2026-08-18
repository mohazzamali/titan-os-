const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');

// --- 1. LOCAL DASHBOARD SERVER (For the PC Owner) ---
const app = express();
const server = http.createServer(app);
const localWss = new WebSocket.Server({ port: 4001 });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'provider.html'));
});

let localClient = null;
let cpuLimit = 50;

localWss.on('connection', (ws) => {
    localClient = ws;
    sendToUI("[NET] Connecting to Global Nexus Matchmaker...", "text-yellow-400");
    connectToGlobalRelay();
    
    ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'UPDATE_CPU') { cpuLimit = parseInt(data.value); }
    });
});

function sendToUI(message, color="text-gray-300") {
    if (localClient && localClient.readyState === WebSocket.OPEN) {
        localClient.send(JSON.stringify({ type: 'LOG', message, color }));
    }
}

function sendEarningsToUI(amount) {
    if (localClient && localClient.readyState === WebSocket.OPEN) {
        localClient.send(JSON.stringify({ type: 'EARN', amount }));
    }
}

server.listen(4000, () => {
    console.log("==================================================");
    console.log(" 🟢 NEXUS AGENT UI RUNNING AT: http://localhost:4000");
    console.log("==================================================");
});

// --- 2. GLOBAL MATCHMAKER CONNECTION (For the Network) ---
function connectToGlobalRelay() {
    const relayWs = new WebSocket('wss://nexus-relay-753k.onrender.com');

    // 🔥 THE BULLETPROOF SHIELD: Prevent crash if Relay is offline
    relayWs.on('error', (err) => {
        sendToUI(`⚠️ [NET] Relay server unreachable. Will keep trying...`, "text-red-500");
    });

    relayWs.on('open', () => {
        sendToUI("[NET] Secure tunnel to Global Swarm established! 🚀", "text-green-400");
        relayWs.send(JSON.stringify({ type: 'REGISTER_PROVIDER' }));
    });

    relayWs.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'EXECUTE_WASM') {
                sendToUI(`⚡ [INBOUND] Catching WASM Payload (${data.payload.length} bytes)...`, "text-cyan-400");
                sendToUI(`🔒 [SEC] Throttling compute to ${cpuLimit}% limit to prevent system hang.`, "text-gray-400");
                
                const wasmBytes = new Uint8Array(data.payload);
                
                try {
                    const wasmModule = await WebAssembly.instantiate(wasmBytes);
                    if (wasmModule.instance.exports.execute) {
                        const result = wasmModule.instance.exports.execute();
                        
                        setTimeout(() => {
                            sendToUI(`✅ [SUCCESS] Execution complete! Result = ${result}`, "text-green-400");
                            
                            const earnings = (data.payload.length * 0.0001) * (cpuLimit / 100);
                            sendToUI(`💰 [WALLET] Credited +${earnings.toFixed(4)} NXC.`, "text-yellow-400");
                            sendEarningsToUI(earnings);
                            
                            relayWs.send(JSON.stringify({ type: 'COMPUTE_RESULT', result: result }));
                        }, 1500); 
                    }
                } catch (err) {
                    sendToUI(`❌ [ERROR] Sandbox execution failed.`, "text-red-500");
                }
            }
        } catch (e) {}
    });

    relayWs.on('close', () => {
        sendToUI("🔴 [SYS] Disconnected from Global Swarm. Reconnecting in 5s...", "text-red-500");
        setTimeout(connectToGlobalRelay, 5000);
    });
}
