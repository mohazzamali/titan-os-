#![no_std]
extern crate alloc;

use alloc::string::String;
use alloc::format;
use wasmi::{Engine, Module, Store, Linker};

/// The Core WebAssembly Execution Sandbox for NEXUS OS.
pub struct NexusWasmSandbox {
    engine: Engine,
    pub store: Store<()>,
}

impl NexusWasmSandbox {
    /// Bootstraps the WASM Engine directly on bare-metal.
    pub fn initialize() -> Self {
        let engine = Engine::default();
        let store = Store::new(&engine, ());
        Self { engine, store }
    }

    /// Securely parses a raw array of bytes into a validated WASM Module.
    pub fn parse_payload(&self, wasm_bytes: &[u8]) -> Result<Module, String> {
        match Module::new(&self.engine, wasm_bytes) {
            Ok(module) => Ok(module),
            Err(e) => Err(format!("❌ [ WASM ERROR ] Validation Failed: {:?}", e)),
        }
    }

    /// EXECUTING PHASE 1D: The Real Execution
    /// Instantiates the module and securely executes a typed function.
    pub fn execute_contract(&mut self, module: &Module, func_name: &str, arg1: i32, arg2: i32) -> Result<i32, String> {
        // 1. Create a Linker to link the module to our isolated Store.
        let linker = <Linker<()>>::new(&self.engine);

        // 2. Instantiate the module inside the memory sandbox.
        let instance_pre = match linker.instantiate(&mut self.store, module) {
            Ok(pre) => pre,
            Err(e) => return Err(format!("❌ [ WASM ERROR ] Instantiation Failed: {:?}", e)),
        };

        let instance = match instance_pre.start(&mut self.store) {
            Ok(inst) => inst,
            Err(e) => return Err(format!("❌ [ WASM ERROR ] Start Failed: {:?}", e)),
        };

        // 3. Securely extract the requested function from the WASM binary.
        let func = match instance.get_export(&self.store, func_name) {
            Some(export) => match export.into_func() {
                Some(f) => f,
                None => return Err(format!("❌ [ WASM ERROR ] '{}' is not a function", func_name)),
            },
            None => return Err(format!("❌ [ WASM ERROR ] Export '{}' not found in WASM", func_name)),
        };

        // 4. Enforce STRICT Type-Checking: The function MUST accept two i32s and return one i32.
        let typed_func = match func.typed::<(i32, i32), i32>(&self.store) {
            Ok(tf) => tf,
            Err(e) => return Err(format!("❌ [ WASM FATAL ] Signature mismatch for '{}': {:?}", func_name, e)),
        };

        // 5. THE REAL EXECUTION: Call the function securely on bare-metal.
        match typed_func.call(&mut self.store, (arg1, arg2)) {
            Ok(result) => Ok(result),
            Err(trap) => Err(format!("❌ [ WASM TRAP ] Execution Trapped/Crashed: {:?}", trap)),
        }
    }
}