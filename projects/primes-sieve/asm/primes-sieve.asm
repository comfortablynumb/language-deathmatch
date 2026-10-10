; Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.
; x86-64 Linux, NASM syntax, no libc: raw syscalls, an mmap'd flag array and an own output buffer.

BITS 64
DEFAULT REL

%define SYS_WRITE       1
%define SYS_MMAP        9
%define SYS_EXIT        60
%define STDOUT          1
%define STDERR          2
%define PROT_RW         3               ; PROT_READ | PROT_WRITE
%define MAP_PRIV_ANON   0x22            ; MAP_PRIVATE | MAP_ANONYMOUS
%define MAX_LIMIT       200000000
%define OUT_SIZE        128             ; 3 labels + 3 numbers of at most 20 digits + 3 '\n'

section .rodata
usage:          db "usage: primes-sieve N  (N: 0..200000000)", 10
usage_len:      equ $ - usage
nomem:          db "primes-sieve: cannot allocate the sieve", 10
nomem_len:      equ $ - nomem
label_count:    db "count: "
label_count_len: equ $ - label_count
label_sum:      db "sum: "
label_sum_len:  equ $ - label_sum
label_largest:  db "largest: "
label_largest_len: equ $ - label_largest

section .bss
outbuf:     resb OUT_SIZE               ; buffered stdout (the whole output fits)
digits:     resb 32                     ; scratch space for one number

section .text
global _start

; ---------------------------------------------------------------------------
; Entry point. Stack: [rsp] = argc, [rsp+8] = argv[0], [rsp+16] = argv[1].
; Callee-saved registers hold the state across calls:
;   rbx = flag array (one byte per integer 0..N, 1 = prime)   r12 = N
;   r13 = count   r14 = sum   r15 = largest
; ---------------------------------------------------------------------------
_start:
    cmp     qword [rsp], 2              ; exactly one argument
    jne     usage_error
    mov     rsi, [rsp + 16]             ; rsi = argv[1]
    call    parse_limit                 ; rax = N, CF = 1 on invalid input
    jc      usage_error

    mov     r12, rax
    call    alloc_flags                 ; rbx = zeroed array of N + 1 bytes
    call    sieve
    call    summarize
    call    write_summary
    xor     edi, edi                    ; exit code 0
    jmp     exit

; ---------------------------------------------------------------------------
; parse_limit: parse the NUL-terminated string at rsi as a decimal number.
; out: rax = value; CF = 1 if empty, has a non-digit, or exceeds MAX_LIMIT.
; ---------------------------------------------------------------------------
parse_limit:
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
    cmp     rax, MAX_LIMIT
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
; alloc_flags: mmap an anonymous private mapping of N + 1 bytes (r12 = N).
; The kernel hands out zeroed pages, so every flag starts as 0 (not prime).
; out: rbx = base address. Clobbers rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11.
; ---------------------------------------------------------------------------
alloc_flags:
    mov     eax, SYS_MMAP
    xor     edi, edi                    ; addr = NULL: let the kernel choose
    lea     rsi, [r12 + 1]              ; length = N + 1
    mov     edx, PROT_RW
    mov     r10d, MAP_PRIV_ANON
    mov     r8, -1                      ; fd = -1 (anonymous)
    xor     r9d, r9d                    ; offset = 0
    syscall                             ; rax = address or -errno
    cmp     rax, -4095
    jae     alloc_error                 ; -4095..-1 (unsigned: the top page) is an error
    mov     rbx, rax
    ret

; ---------------------------------------------------------------------------
; sieve: mark 2..N as prime, then for p = 2, 3, ... while p * p <= N, cross off
; p * p, p * p + p, ... <= N when p is still marked prime.
; in: rbx = flags, r12 = N. Clobbers rax, rcx, rdi.
; ---------------------------------------------------------------------------
sieve:
    cmp     r12, 2
    jb      .done                       ; no integer in 2..N: nothing to mark
    lea     rdi, [rbx + 2]
    lea     rcx, [r12 - 1]              ; N - 1 flags for 2..N
    mov     eax, 1
    rep     stosb                       ; flags[2..N] = 1 (0 and 1 stay 0)

    mov     ecx, 2                      ; rcx = p

.outer:
    mov     rax, rcx
    imul    rax, rcx                    ; rax = p * p (64-bit, no overflow)
    cmp     rax, r12
    ja      .done                       ; p * p > N: finished
    cmp     byte [rbx + rcx], 0
    je      .next_p                     ; p is composite: skip it

.cross:
    mov     byte [rbx + rax], 0         ; flags[multiple] = 0
    add     rax, rcx                    ; multiple += p
    cmp     rax, r12
    jbe     .cross

.next_p:
    inc     rcx
    jmp     .outer

.done:
    ret

; ---------------------------------------------------------------------------
; summarize: scan flags[0..N]; for every prime i: count++, sum += i, largest = i.
; in: rbx = flags, r12 = N. out: r13 = count, r14 = sum, r15 = largest.
; Clobbers rcx.
; ---------------------------------------------------------------------------
summarize:
    xor     r13d, r13d
    xor     r14d, r14d
    xor     r15d, r15d
    xor     ecx, ecx                    ; rcx = i

.scan:
    cmp     byte [rbx + rcx], 0
    je      .next_i                     ; not prime
    inc     r13
    add     r14, rcx
    mov     r15, rcx

.next_i:
    inc     rcx
    cmp     rcx, r12
    jbe     .scan                       ; i <= N (flags[0] always exists)
    ret

; ---------------------------------------------------------------------------
; write_summary: format "count: C\nsum: S\nlargest: P\n" into outbuf and flush.
; in: r13 = count, r14 = sum, r15 = largest.
; ---------------------------------------------------------------------------
write_summary:
    lea     rdi, [outbuf]
    lea     rsi, [label_count]
    mov     ecx, label_count_len
    mov     rax, r13
    call    append_field

    lea     rsi, [label_sum]
    mov     ecx, label_sum_len
    mov     rax, r14
    call    append_field

    lea     rsi, [label_largest]
    mov     ecx, label_largest_len
    mov     rax, r15
    call    append_field

    jmp     flush                       ; tail call: flush returns to our caller

; ---------------------------------------------------------------------------
; append_field: copy rcx label bytes from rsi to rdi, then append rax and '\n'.
; out: rdi advanced. Clobbers rax, rcx, rdx, rsi, r8.
; ---------------------------------------------------------------------------
append_field:
    rep     movsb                       ; copy [rsi] -> [rdi], rdi += rcx
    jmp     append_u64                  ; tail call

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
; Exit paths. The flag array is not unmapped: exit releases it.
; ---------------------------------------------------------------------------
alloc_error:
    mov     eax, SYS_WRITE
    mov     edi, STDERR
    lea     rsi, [nomem]
    mov     edx, nomem_len
    syscall
    jmp     write_error

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
