import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 🚀 FORWARDING THE FILE TO GLOBAL RENDER RELAY
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const res = await fetch("https://nexus-relay-753k.onrender.com/submit-task", {
      method: "POST",
      body: backendFormData,
    });

    if (!res.ok) {
      throw new Error("Cloud Relay rejected the payload");
    }

    return NextResponse.json({ message: "Payload injected into Cloud Matrix successfully." });
  } catch (error) {
    console.error("Deploy Error:", error);
    return NextResponse.json({ error: "Failed to reach Cloud Relay." }, { status: 500 });
  }
}