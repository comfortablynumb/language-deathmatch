; Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.
; x86-64 Linux, NASM syntax, no libc: raw syscalls, a hand-managed output buffer and
; SSE2 scalar doubles (one rounded operation per instruction, never fused).

BITS 64
DEFAULT REL

%define SYS_WRITE       1
%define SYS_EXIT        60
%define STDOUT          1
%define STDERR          2
%define MAX_SIZE        16000
%define MAX_ITERATIONS  50
%define BUF_SIZE        65536
%define MAX_ROW         2000            ; ceil(MAX_SIZE / 8) bytes per row

section .rodata
usage:      db "usage: mandelbrot N  (N: 1..16000)", 10
usage_len:  equ $ - usage
two:        dq 2.0
limit:      dq 4.0                      ; escape radius squared
x_offset:   dq 1.5                      ; cr = 2x/N - 1.5
y_offset:   dq 1.0                      ; ci = 2y/N - 1.0

section .bss
outbuf:     resb BUF_SIZE               ; buffered stdout
digits:     resb 32                     ; scratch space for one number

section .text
global _start

; ---------------------------------------------------------------------------
; Entry point. Stack: [rsp] = argc, [rsp+8] = argv[0], [rsp+16] = argv[1].
; Registers kept for the whole run:
;   r12 = N   r13 = y (current row)   r15 = flush threshold   rdi = write cursor
;   xmm8 = N as a double   xmm10 = 2.0   xmm11 = 4.0
; ---------------------------------------------------------------------------
_start:
    cmp     qword [rsp], 2              ; exactly one argument
    jne     usage_error
    mov     rsi, [rsp + 16]             ; rsi = argv[1]
    call    parse_size                  ; rax = N, CF = 1 on invalid input
    jc      usage_error

    mov     r12, rax
    cvtsi2sd xmm8, r12                  ; exact: N < 2^53
    movsd   xmm10, [two]
    movsd   xmm11, [limit]
    lea     rdi, [outbuf]
    call    write_header

    lea     r15, [outbuf + BUF_SIZE - MAX_ROW]
    xor     r13d, r13d                  ; y = 0

.row:
    cmp     r13, r12
    jae     .done
    cmp     rdi, r15                    ; room for one more row?
    jb      .render
    call    flush                       ; resets rdi to outbuf

.render:
    call    render_row                  ; row y at rdi, advances rdi
    inc     r13
    jmp     .row

.done:
    call    flush
    xor     edi, edi                    ; exit code 0
    jmp     exit

; ---------------------------------------------------------------------------
; parse_size: parse the NUL-terminated string at rsi as a decimal number.
; out: rax = value; CF = 1 if empty, has a non-digit, is 0 or exceeds MAX_SIZE.
; ---------------------------------------------------------------------------
parse_size:
    xor     eax, eax
    cmp     byte [rsi], 0
    je      .invalid                    ; empty argument

.next:
    movzx   ecx, byte [rsi]
    test    ecx, ecx
    jz      .end                        ; end of string
    sub     ecx, '0'
    cmp     ecx, 9
    ja      .invalid                    ; below '0' wraps around, so one check covers both sides
    imul    rax, rax, 10
    add     rax, rcx
    cmp     rax, MAX_SIZE
    ja      .invalid                    ; also stops overflow on very long inputs
    inc     rsi
    jmp     .next

.end:
    test    rax, rax
    jz      .invalid                    ; N = 0 is not an image
    clc
    ret

.invalid:
    stc
    ret

; ---------------------------------------------------------------------------
; write_header: write "P4\n{N} {N}\n" at rdi and advance rdi.
; Clobbers rax, rcx, rdx, rsi, r8.
; ---------------------------------------------------------------------------
write_header:
    mov     byte [rdi], 'P'
    mov     byte [rdi + 1], '4'
    mov     byte [rdi + 2], 10
    add     rdi, 3
    mov     rax, r12
    call    append_u64                  ; width
    mov     byte [rdi], ' '
    inc     rdi
    mov     rax, r12
    call    append_u64                  ; height
    mov     byte [rdi], 10
    inc     rdi
    ret

; ---------------------------------------------------------------------------
; append_u64: write rax in decimal at rdi and advance rdi.
; x / 10 is computed as (x * 0xCCCCCCCCCCCCCCCD) >> 67, as compilers do.
; Clobbers rax, rcx, rdx, rsi, r8.
; ---------------------------------------------------------------------------
append_u64:
    lea     rsi, [digits + 32]          ; digits are built backwards from the end
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
    sub     rcx, rsi                    ; rcx = number of digits
    rep     movsb                       ; copy [rsi] -> [rdi], rdi += rcx
    ret

; ---------------------------------------------------------------------------
; render_row: pack the N pixels of row r13 at rdi, 8 per byte, MSB first;
; the last byte is padded with zero bits. Advances rdi.
;   r14 = x   r8b = bits of the byte being filled   xmm1 = ci
; Clobbers rax, rcx, r8, r14, xmm0-xmm7.
; ---------------------------------------------------------------------------
render_row:
    cvtsi2sd xmm1, r13
    mulsd   xmm1, xmm10                 ; 2.0 * y
    divsd   xmm1, xmm8                  ; / N
    subsd   xmm1, [y_offset]            ; ci = 2.0 * y / N - 1.0
    xor     r14d, r14d                  ; x = 0
    xor     r8d, r8d                    ; empty byte

.pixel:
    cvtsi2sd xmm0, r14
    mulsd   xmm0, xmm10                 ; 2.0 * x
    divsd   xmm0, xmm8                  ; / N
    subsd   xmm0, [x_offset]            ; cr = 2.0 * x / N - 1.5
    call    in_set                      ; CF = 1 when the point stays in the set
    adc     r8d, r8d                    ; bits = bits * 2 + CF
    inc     r14
    test    r14b, 7
    jnz     .next                       ; byte not full yet
    mov     [rdi], r8b
    inc     rdi
    xor     r8d, r8d

.next:
    cmp     r14, r12
    jb      .pixel

    mov     ecx, r12d
    and     ecx, 7                      ; pixels in the unfinished byte
    jz      .row_done
    neg     ecx
    add     ecx, 8                      ; cl = 8 - pixels: shift them to the top
    shl     r8d, cl
    mov     [rdi], r8b
    inc     rdi

.row_done:
    ret

; ---------------------------------------------------------------------------
; in_set: iterate z = z² + c up to MAX_ITERATIONS times for c = xmm0 + i·xmm1.
; out: CF = 1 if tr + ti <= 4.0 after the loop (the point stays in the set).
;   xmm2 = zr   xmm3 = zi   xmm4 = tr = zr²   xmm5 = ti = zi²   ecx = iterations left
; Clobbers ecx, xmm2-xmm7.
; ---------------------------------------------------------------------------
in_set:
    xorpd   xmm2, xmm2                  ; zr = 0
    xorpd   xmm3, xmm3                  ; zi = 0
    xorpd   xmm4, xmm4                  ; tr = 0
    xorpd   xmm5, xmm5                  ; ti = 0
    mov     ecx, MAX_ITERATIONS

.iterate:
    movapd  xmm6, xmm4
    addsd   xmm6, xmm5                  ; xmm6 = tr + ti
    ucomisd xmm11, xmm6                 ; CF = 1 when 4.0 < tr + ti (or NaN)
    jb      .escaped
    test    ecx, ecx
    jz      .bounded                    ; all iterations done, still bounded
    movapd  xmm7, xmm2
    mulsd   xmm7, xmm10                 ; 2.0 * zr
    mulsd   xmm3, xmm7                  ; (2.0 * zr) * zi
    addsd   xmm3, xmm1                  ; zi = 2.0 * zr * zi + ci
    movapd  xmm2, xmm4
    subsd   xmm2, xmm5                  ; tr - ti
    addsd   xmm2, xmm0                  ; zr = tr - ti + cr
    movapd  xmm4, xmm2
    mulsd   xmm4, xmm4                  ; tr = zr * zr
    movapd  xmm5, xmm3
    mulsd   xmm5, xmm5                  ; ti = zi * zi
    dec     ecx
    jmp     .iterate

.bounded:
    stc
    ret

.escaped:
    clc
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
