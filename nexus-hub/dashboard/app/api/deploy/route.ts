import { NextResponse } from 'next/server';
import WebSocket from 'ws';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "❌ TASK FAILED: No payload detected." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.length < 4 || buffer[0] !== 0x00 || buffer[1] !== 0x61 || buffer[2] !== 0x73 || buffer[3] !== 0x6d) {
      return NextResponse.json({ 
        error: "☠️ THREAT DETECTED: Invalid payload. Only pure .wasm files are allowed." 
      }, { status: 403 });
    }

    await new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8080');
        
        ws.on('open', () => {
            const payloadArray = Array.from(buffer);
            ws.send(JSON.stringify({
                type: 'DEPLOY_TASK',
                payload: payloadArray
            }));
            ws.close();
            resolve(true);
        });

        ws.on('error', (err) => reject(err));
    });

    return NextResponse.json({ 
      message: `✅ PAYLOAD SECURED & BROADCASTED: ${buffer.length} bytes injected.` 
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ 
      error: "❌ SERVER MATRIX ERROR: Could not connect to Relay Hub (Is Port 8080 open?)." 
    }, { status: 500 });
  }
}
