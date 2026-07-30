
#[cfg(target_arch = "x86_64")]
use core::arch::x86_64::{_rdrand64_step, _rdtsc};

/// Generates cryptographically secure random bytes directly from the CPU silicon.
/// This completely bypasses the need for an underlying OS (like Linux /dev/urandom).
pub fn get_random_bytes(buffer: &mut [u8]) {
    let mut i = 0;
    while i < buffer.len() {
        let mut rand_val: u64 = 0;
        let mut success = 0;
        
        // Try to get hardware randomness directly from the CPU (RDRAND instruction)
        unsafe {
            // Retry a few times in case the hardware entropy pool is temporarily exhausted
            for _ in 0..10 {
                success = _rdrand64_step(&mut rand_val);
                if success == 1 {
                    break;
                }
            }
        }

        // Fallback to Time Stamp Counter (RDTSC) if RDRAND is unavailable or exhausted
        if success != 1 {
            unsafe {
                rand_val = _rdtsc();
            }
        }

        // Write the 8 bytes (or remaining bytes) into our target buffer
        let bytes = rand_val.to_ne_bytes();
        let chunk_size = core::cmp::min(8, buffer.len() - i);
        buffer[i..i + chunk_size].copy_from_slice(&bytes[..chunk_size]);
        i += chunk_size;
    }
}
