// nexus-core/src/consensus.rs

extern crate alloc;
use alloc::vec::Vec;
use alloc::string::String;
use alloc::format;
use spin::Mutex;

// 🚀 1. DYNAMIC ACCOUNT STRUCTURE (Stored in RAM)
pub struct Account {
    pub node_id: String,
    pub balance: u64,
}

// 🚀 2. THE REAL BFT LEDGER
pub struct Ledger {
    pub accounts: Vec<Account>,
    pub total_tasks: u64,
}

impl Ledger {
    pub const fn new() -> Self {
        Ledger {
            accounts: Vec::new(),
            total_tasks: 0,
        }
    }

    pub fn submit_task(&mut self, _task_id: u64, _result: i32) {
        self.total_tasks += 1;
    }

    pub fn receive_vote(&mut self, _task_id: u64, _node_id: u8, _vote: bool) {
        // We simulate Node Alpha completing the WASM task
        let target_id = String::from("NODE_ALPHA");
        let reward_amount = 930; // Mint 930 NXC per task
        
        // Search if account already exists in RAM
        let mut found = false;
        for acc in self.accounts.iter_mut() {
            if acc.node_id == target_id {
                acc.balance += reward_amount; // Add to existing balance!
                found = true;
                break;
            }
        }

        // If account doesn't exist, allocate it dynamically!
        if !found {
            self.accounts.push(Account {
                node_id: target_id,
                balance: reward_amount,
            });
        }

        // Calculate Total Value Locked (TVL) dynamically
        let total_supply: u64 = self.accounts.iter().map(|a| a.balance).sum();
        
        // Dynamically format the string using our Heap Memory!
        let msg = format!("LEDGER: ALPHA BAL = {} NXC", self.accounts[0].balance);
        let msg_tvl = format!("NETWORK TVL = {} NXC", total_supply);
        
        // Pad to clear old characters (prevents screen bleed)
        let mut padded1 = msg; while padded1.len() < 38 { padded1.push(' '); }
        let mut padded2 = msg_tvl; while padded2.len() < 38 { padded2.push(' '); }

        // Render live stats to the Matrix Dashboard (Lines 18 & 19 on Right Panel)
        crate::graphics::write_result_to_screen(18, &padded1, 0x0E); // Yellow Text
        crate::graphics::write_result_to_screen(19, &padded2, 0x0B); // Cyan Text
    }
}

pub static BFT_LEDGER: Mutex<Ledger> = Mutex::new(Ledger::new());