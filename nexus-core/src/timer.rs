// nexus-core/src/timer.rs

use x86_64::instructions::port::Port;

// PIT Base Frequency is ~1.193182 MHz
const PIT_DIVIDEND: u32 = 1193182;

pub fn configure_pit(target_hz: u32) {
    let mut command_port: Port<u8> = Port::new(0x43);
    let mut data_port: Port<u8> = Port::new(0x40);

    let divisor = (PIT_DIVIDEND / target_hz) as u16;

    unsafe {
        // Command byte: Channel 0, LSB/MSB access, Mode 2 (Rate Generator), Binary mode
        command_port.write(0x36);
        
        // Send Low Byte of divisor
        data_port.write((divisor & 0xFF) as u8);
        
        // Send High Byte of divisor
        data_port.write(((divisor >> 8) & 0xFF) as u8);
    }
}