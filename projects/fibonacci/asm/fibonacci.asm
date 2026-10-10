; Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.
; x86-64 Linux, NASM syntax, no libc: raw syscalls and a hand-managed output buffer.

BITS 64
DEFAULT REL

%define SYS_WRITE   1
%define SYS_EXIT    60
%define STDOUT      1
%define STDERR      2
%define MAX_COUNT   1000000000
%define BUF_SIZE    65536
%define MAX_LINE    21                  ; 20 digits (2^64 - 1) + '\n'

section .rodata
usage:      db "usage: fibonacci N  (N: 0..1000000000)", 10
usage_len:  equ $ - usage

section .bss
outbuf:     resb BUF_SIZE               ; buffered stdout
digits:     resb 32                     ; scratch space for one number

section .text
global _start

; ---------------------------------------------------------------------------
; Entry point. Stack: [rsp] = argc, [rsp+8] = argv[0], [rsp+16] = argv[1].
; Registers in the main loop:
;   r12 = numbers left   r13 = a = F(i)   r14 = b = F(i+1)
;   r15 = flush threshold (cursor limit)   rdi = write cursor into outbuf
; ---------------------------------------------------------------------------
_start:
    cmp     qword [rsp], 2              ; exactly one argument
    jne     usage_error
    mov     rsi, [rsp + 16]             ; rsi = argv[1]
    call    parse_count                 ; rax = N, CF = 1 on invalid input
    jc      usage_error

    mov     r12, rax
    xor     r13d, r13d                  ; a = 0
    mov     r14d, 1                     ; b = 1
    lea     r15, [outbuf + BUF_SIZE - MAX_LINE]
    lea     rdi, [outbuf]

.loop:
    test    r12, r12
    jz      .done
    cmp     rdi, r15                    ; room for one more line?
    jb      .append
    call    flush                       ; resets rdi to outbuf

.append:
    mov     rax, r13
    call    append_u64                  ; "a\n" at rdi, advances rdi
    lea     rax, [r13 + r14]            ; next = a + b, wraps modulo 2^64
    mov     r13, r14
    mov     r14, rax
    dec     r12
    jmp     .loop

.done:
    call    flush
    xor     edi, edi                    ; exit code 0
    jmp     exit

; ---------------------------------------------------------------------------
; parse_count: parse the NUL-terminated string at rsi as a decimal number.
; out: rax = value; CF = 1 if empty, has a non-digit, or exceeds MAX_COUNT.
; ---------------------------------------------------------------------------
parse_count:
    xor     eax, eax
    cmp     byte [rsi], 0
    je      .invalid                    ; empty argument

.next:
    movzx   ecx, byte [rsi]
    test    ecx, ecx
    jz      .valid                      ; end of string
    sub     ecx, '0'
    cmp     ecx, 9
    ja      .invalid                    ; below '0' wraps around, so one check covers both sides
    imul    rax, rax, 10
    add     rax, rcx
    cmp     rax, MAX_COUNT
    ja      .invalid                    ; also stops overflow on very long inputs
    inc     rsi
    jmp     .next

.valid:
    clc
    ret

.invalid:
    stc
    ret

; ---------------------------------------------------------------------------
; append_u64: write rax in decimal plus '\n' at rdi and advance rdi.
; x / 10 is computed as (x * 0xCCCCCCCCCCCCCCCD) >> 67, as compilers do.
; Clobbers rax, rcx, rdx, rsi, r8.
; ---------------------------------------------------------------------------
append_u64:
    lea     rsi, [digits + 31]
    mov     byte [rsi], 10              ; digits are built backwards, '\n' last
    mov     r8, 0xCCCCCCCCCCCCCCCD

.digit:
    mov     rcx, rax                    ; rcx = x
    mul     r8                          ; rdx:rax = x * magic
    shr     rdx, 3                      ; rdx = q = x / 10
    lea     rax, [rdx + rdx * 4]
    add     rax, rax                    ; rax = q * 10
    sub     rcx, rax                    ; rcx = x - q * 10 = last digit
    add     cl, '0'
    dec     rsi
    mov     [rsi], cl
    mov     rax, rdx                    ; x = q
    test    rax, rax
    jnz     .digit

    lea     rcx, [digits + 32]
    sub     rcx, rsi                    ; rcx = line length
    rep     movsb                       ; copy [rsi] -> [rdi], rdi += rcx
    ret

; ---------------------------------------------------------------------------
; flush: write outbuf[0 .. rdi) to stdout, retrying on partial writes.
; out: rdi = outbuf. Clobbers rax, rcx, rdx, rsi, r11.
; ---------------------------------------------------------------------------
flush:
    lea     rsi, [outbuf]               ; rsi = first pending byte
    mov     rdx, rdi
    sub     rdx, rsi                    ; rdx = pending byte count

.write:
    test    rdx, rdx
    jz      .flushed
    mov     eax, SYS_WRITE
    mov     edi, STDOUT
    syscall                             ; rax = bytes written or -errno
    test    rax, rax
    jle     write_error
    add     rsi, rax
    sub     rdx, rax
    jmp     .write

.flushed:
    lea     rdi, [outbuf]
    ret

; ---------------------------------------------------------------------------
; Exit paths.
; ---------------------------------------------------------------------------
usage_error:
    mov     eax, SYS_WRITE
    mov     edi, STDERR
    lea     rsi, [usage]
    mov     edx, usage_len
    syscall

write_error:
    mov     edi, 1                      ; exit code 1

exit:
    mov     eax, SYS_EXIT
    syscall
