// nexus-core/src/process.rs
extern crate alloc;
use alloc::vec::Vec;

#[derive(Debug, Clone, Copy)]
#[repr(C, packed)]
pub struct CPUState {
    pub r15: u64, pub r14: u64, pub r13: u64, pub r12: u64,
    pub r11: u64, pub r10: u64, pub r9: u64,  pub r8: u64,
    pub rbp: u64, pub rdi: u64, pub rsi: u64, pub rdx: u64,
    pub rcx: u64, pub rbx: u64, pub rax: u64,
    pub rip: u64, pub cs: u64, pub rflags: u64, pub rsp: u64, pub ss: u64,
}

pub struct Task {
    pub id: u64,
    pub stack_pointer: u64,
    pub memory_stack: Vec<u8>, 
}

impl Task {
    pub fn new(id: u64, entry_point: u64) -> Self {
        // 🚀 CRITICAL FIX: Increased Task Stack from 8KB to 128KB to support smoltcp routing!
        let stack = alloc::vec![0; 131_072]; 
        let stack_end = stack.as_ptr() as u64 + stack.len() as u64;
        
        let mut rsp = (stack_end - 512) & !0xF; 

        let state = CPUState {
            r15: 0, r14: 0, r13: 0, r12: 0, r11: 0, r10: 0, r9: 0, r8: 0,
            rbp: 0, rdi: 0, rsi: 0, rdx: 0, rcx: 0, rbx: 0, rax: 0,
            rip: entry_point, 
            cs: 0x8,          
            rflags: 0x202,    
            rsp: rsp,         
            ss: 0x0,          
        };

        rsp -= core::mem::size_of::<CPUState>() as u64;
        unsafe { core::ptr::write_volatile(rsp as *mut CPUState, state); }

        Task { id, stack_pointer: rsp, memory_stack: stack }
    }
}
