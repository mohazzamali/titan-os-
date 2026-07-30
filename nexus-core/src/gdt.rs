// nexus-core/src/gdt.rs

use x86_64::structures::gdt::{GlobalDescriptorTable, Descriptor, SegmentSelector};
use lazy_static::lazy_static;

pub struct Selectors {
    pub kernel_code: SegmentSelector,
    pub kernel_data: SegmentSelector,
    pub user_data: SegmentSelector, // 🚀 Swapped order!
    pub user_code: SegmentSelector, 
}

lazy_static! {
    pub static ref GDT: (GlobalDescriptorTable, Selectors) = {
        let mut gdt = GlobalDescriptorTable::new();
        
        let kernel_code = gdt.add_entry(Descriptor::kernel_code_segment());
        let kernel_data = gdt.add_entry(Descriptor::kernel_data_segment());
        
        // 🚀 THE GDT FIX: User Data MUST come BEFORE User Code for x86_64 sysret!
        let user_data = gdt.add_entry(Descriptor::user_data_segment());
        let user_code = gdt.add_entry(Descriptor::user_code_segment());
        
        (gdt, Selectors { kernel_code, kernel_data, user_data, user_code })
    };
}

pub fn init() {
    GDT.0.load();
    unsafe {
        use x86_64::instructions::segmentation::{CS, DS, ES, FS, GS, Segment};
        CS::set_reg(GDT.1.kernel_code);
        DS::set_reg(GDT.1.kernel_data);
        ES::set_reg(GDT.1.kernel_data);
        FS::set_reg(GDT.1.kernel_data);
        GS::set_reg(GDT.1.kernel_data);
    }
}