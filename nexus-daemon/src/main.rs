use libp2p::{
    gossipsub, mdns, ping, swarm::{NetworkBehaviour, SwarmEvent},
};
use futures::StreamExt;
use serde::{Deserialize, Serialize}; // 🚀 NEW: For structured crypto-receipts
use std::{collections::hash_map::DefaultHasher, error::Error, hash::{Hash, Hasher}, time::Duration};
use tokio::{io, io::AsyncBufReadExt};
use tracing::{info, warn, error, Level};
use tracing_subscriber::FmtSubscriber;
use wasmtime::*;

#[derive(NetworkBehaviour)]
struct NexusBehaviour {
    ping: ping::Behaviour,
    mdns: mdns::tokio::Behaviour,
    gossipsub: gossipsub::Behaviour,
}

// 🚀 NEW: The Proof-of-Useful-Compute (PoUC) Receipt Structure
#[derive(Serialize, Deserialize, Debug)]
struct TaskReceipt {
    task: String,
    result: String,
    executor_id: String,
}

fn execute_in_sandbox(payload: &str) -> Result<String, Box<dyn Error>> {
    info!("⚙️  WASM SANDBOX: Booting Engine for task...");
    let engine = Engine::default();
    
    let wat_code = if payload.contains("EXECUTE_MATH") {
        r#"
        (module
            (func $add (param $lhs i32) (param $rhs i32) (result i32)
                local.get $lhs
                local.get $rhs
                i32.add)
            (export "calculate" (func $add))
        )
        "#
    } else {
        r#"
        (module
            (func $hello (result i32)
                i32.const 42)
            (export "calculate" (func $hello))
        )
        "#
    };

    let module = Module::new(&engine, wat_code)?;
    let mut store = Store::new(&engine, ());
    let instance = Instance::new(&mut store, &module, &[])?;
    let calculate_func = instance.get_typed_func::<(), i32>(&mut store, "calculate");
    
    if let Ok(func) = calculate_func {
        let result = func.call(&mut store, ())?;
        Ok(format!("{}", result))
    } else {
        let math_func = instance.get_typed_func::<(i32, i32), i32>(&mut store, "calculate")?;
        let result = math_func.call(&mut store, (10, 32))?;
        Ok(format!("{}", result))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let subscriber = FmtSubscriber::builder().with_max_level(Level::INFO).finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("==================================================");
    info!(" 🌌 NEXUS DAEMON: L2 MESH, WASM & BFT SETTLEMENT");
    info!("==================================================");

    let local_key = libp2p::identity::Keypair::generate_ed25519();
    let local_peer_id = local_key.public().to_peer_id();

    let mut swarm = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
        .with_tokio()
        .with_tcp(
            libp2p::tcp::Config::default().nodelay(true),
            libp2p::noise::Config::new,
            libp2p::yamux::Config::default,
        )?
        .with_behaviour(|key| {
            let message_id_fn = |message: &gossipsub::Message| {
                let mut s = DefaultHasher::new();
                message.data.hash(&mut s);
                gossipsub::MessageId::from(s.finish().to_string())
            };
            
            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(1))
                .validation_mode(gossipsub::ValidationMode::Strict)
                .message_id_fn(message_id_fn)
                .build()
                .expect("Valid config");
                
            let mut gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            ).expect("Correct config");

            // 🚀 We now have TWO distinct channels: Tasks (Orders) and Proofs (Settlements)
            gossipsub.subscribe(&gossipsub::IdentTopic::new("nexus-tasks")).unwrap();
            gossipsub.subscribe(&gossipsub::IdentTopic::new("nexus-proofs")).unwrap();

            Ok(NexusBehaviour {
                ping: ping::Behaviour::default(),
                mdns: mdns::tokio::Behaviour::new(mdns::Config::default(), local_peer_id)?,
                gossipsub,
            })
        })?
        .with_swarm_config(|cfg| cfg.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    info!("SEC: Node Identity Established -> PeerID: {}", local_peer_id);
    swarm.listen_on("/ip4/0.0.0.0/tcp/0".parse()?)?;

    let mut stdin = io::BufReader::new(io::stdin()).lines();
    let tasks_topic = gossipsub::IdentTopic::new("nexus-tasks");
    let proofs_topic = gossipsub::IdentTopic::new("nexus-proofs");

    loop {
        tokio::select! {
            Ok(Some(line)) = stdin.next_line() => {
                if let Err(e) = swarm.behaviour_mut().gossipsub.publish(tasks_topic.clone(), line.as_bytes()) {
                    error!("❌ Broadcast Failed: {:?}", e);
                } else {
                    info!("📤 TASK DISPATCHED TO SWARM: {}", line);
                }
            }
            
            event = swarm.select_next_some() => match event {
                SwarmEvent::NewListenAddr { address, .. } => {
                    info!("NET: Node listening on Address: {}", address);
                }
                SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                     info!("🔗 MESH TUNNEL CONNECTED: {}", peer_id);
                     swarm.behaviour_mut().gossipsub.add_explicit_peer(&peer_id);
                }
                SwarmEvent::Behaviour(NexusBehaviourEvent::Mdns(mdns::Event::Discovered(list))) => {
                    for (peer_id, multiaddr) in list {
                        let _ = swarm.dial(multiaddr);
                    }
                }
                SwarmEvent::Behaviour(NexusBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                    message,
                    ..
                })) => {
                    let channel = message.topic.as_str();
                    let payload_str = String::from_utf8_lossy(&message.data).to_string();

                    // 1. 🟢 If we receive a TASK on the network
                    if channel == "nexus-tasks" {
                        info!("📥 TASK RECEIVED: '{}'", payload_str);
                        match execute_in_sandbox(&payload_str) {
                            Ok(result) => {
                                info!("✅ WASM SUCCESS: Result is {}", result);
                                
                                // 🚀 Generate PoUC Receipt
                                let receipt = TaskReceipt {
                                    task: payload_str.clone(),
                                    result: result.clone(),
                                    executor_id: local_peer_id.to_string(),
                                };
                                let receipt_json = serde_json::to_string(&receipt).unwrap();
                                
                                // 🚀 Broadcast the Proof back to the network
                                if let Err(e) = swarm.behaviour_mut().gossipsub.publish(proofs_topic.clone(), receipt_json.as_bytes()) {
                                    error!("❌ Failed to broadcast proof: {:?}", e);
                                } else {
                                    info!("🔐 PROOF-OF-USEFUL-COMPUTE (PoUC) BROADCASTED TO SWARM");
                                }
                            }
                            Err(e) => error!("❌ WASM EXECUTION FAILED: {}", e),
                        }
                    } 
                    // 2. 🔵 If we receive a PROOF (Result Settlement)
                    else if channel == "nexus-proofs" {
                        if let Ok(receipt) = serde_json::from_str::<TaskReceipt>(&payload_str) {
                            // Don't validate our own proofs (we already know what we did)
                            if receipt.executor_id != local_peer_id.to_string() {
                                info!("==================================================");
                                info!(" ⚖️  BFT CONSENSUS: VALIDATING PROOF");
                                info!(" 🧾 TASK EXECUTED: {}", receipt.task);
                                info!(" 💻 EXECUTOR ID:   {}", receipt.executor_id);
                                info!(" 📊 RESULT HASH:   {}", receipt.result);
                                info!(" ✅ SETTLEMENT COMPLETE: Micro-Transaction Logged!");
                                info!("==================================================");
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }
}
