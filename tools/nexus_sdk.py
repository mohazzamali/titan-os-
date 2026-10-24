#!/usr/bin/env python3
import json
import urllib.request
import base64
import os
import sys

class NexusClient:
    def __init__(self, endpoint="http://localhost:3000/api/deploy"):
        self.endpoint = endpoint

    def compute(self, vector, kernel="quant_monte_carlo", shards=8, wasm_path=None):
        payload = {
            "clientSource": "PYTHON_SDK_BRIDGE",
            "presetKernelId": kernel,
            "inputVector": vector,
            "totalShards": shards
        }
        if wasm_path and os.path.exists(wasm_path):
            with open(wasm_path, "rb") as f:
                payload["wasmBase64"] = base64.b64encode(f.read()).decode("ascii")
                payload["fileName"] = os.path.basename(wasm_path)

        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=65) as resp:
            return json.loads(resp.read().decode("utf-8"))

if __name__ == "__main__":
    client = NexusClient()
    vec = [45, 80, 120, 165, 256, 720]
    print("🐍 [Nexus Python SDK] Offloading vector", vec, "to M4 Cluster...")
    res = client.compute(vector=vec, kernel="zk_sha256_merkle", shards=8)
    print(f"✅ Block #{res['blockHeight']} | Wall: {res['swarmParallelWallMs']} ms | Rate: {res['tokenomicsAudit']['swarmTotalGops']} GOPS")
    print(f"🏆 Verified Output Vector: {res['verifiedMinerOutputVector']}")
    print(f"🔐 Ed25519 Merkle Seal   : 0x{res['merkleStateSeal'][:32]}...")
