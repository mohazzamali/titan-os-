[bits 16]
[org 0x8000]

start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax

    lgdt [gdt_pointer]

    mov eax, cr0
    or eax, 1
    mov cr0, eax

    jmp dword 0x18:protected_mode

[bits 32]
protected_mode:
    mov ax, 0x20
    mov ds, ax
    mov es, ax
    mov ss, ax

    mov eax, cr4
    or eax, 1 << 5
    mov cr4, eax

    ; Read the Real OS CR3 safely from 0x9000
    mov eax, dword [0x9000]
    mov cr3, eax

    mov ecx, 0xC0000080
    rdmsr
    or eax, (1 << 8) | (1 << 11) ; Enable LME and NXE (No-Execute)
    wrmsr

    mov eax, cr0
    or eax, 1 << 31
    mov cr0, eax

    jmp 0x08:long_mode

[bits 64]
long_mode:
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov fs, ax
    mov gs, ax
    mov ss, ax

    mov rax, cr4
    or rax, (3 << 9)
    mov cr4, rax

    ; Load AP Stack securely
    mov rsp, qword [0x9008]
    and rsp, -16

    mov dword [0x9018], 1

    mov rax, qword [0x9010]
    call rax

    cli
.halt_loop:
    hlt
    jmp .halt_loop

ALIGN 8
gdt:
    dq 0 
.code64: equ $ - gdt
    dq (1<<43) | (1<<44) | (1<<47) | (1<<53)
.data64: equ $ - gdt
    dq (1<<44) | (1<<47) | (1<<41)
.code32: equ $ - gdt
    dq 0x00cf9a000000ffff
.data32: equ $ - gdt
    dq 0x00cf92000000ffff
gdt_pointer:
    dw $ - gdt - 1
    dd gdt