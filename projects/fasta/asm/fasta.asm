; Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).
; x86-64 Linux, NASM syntax, no libc: raw syscalls, a hand-managed output buffer and
; SSE2 scalar doubles for the random numbers.

BITS 64
DEFAULT REL

%define SYS_WRITE   1
%define SYS_EXIT    60
%define STDOUT      1
%define STDERR      2
%define MAX_COUNT   25000000
%define BUF_SIZE    65536
%define LINE_WIDTH  60
%define MAX_LINE    61                  ; 60 symbols + '\n'; headers are shorter
%define MAX_ENTRIES 16                  ; room for the largest table (IUB: 15)

; Linear congruential generator: seed = (seed * IA + IC) mod IM.
%define IM          139968
%define IA          3877
%define IC          29573
%define SEED        42
; x / IM == (x * IM_MAGIC) >> IM_SHIFT for every x = seed * IA + IC (all < 2^30),
; the reciprocal multiplication compilers emit for a constant divisor.
%define IM_MAGIC    2010995204          ; ceil(2^48 / IM), fits a signed 32-bit immediate
%define IM_SHIFT    48

; The 287-character ALU string, in pieces so it can be emitted twice.
%define ALU_1 "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG"
%define ALU_2 "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA"
%define ALU_3 "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT"
%define ALU_4 "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA"
%define ALU_5 "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG"
%define ALU_6 "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC"
%define ALU_7 "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA"

section .rodata
usage:          db "usage: fasta N  (N: 0..25000000)", 10
usage_len:      equ $ - usage

header_one:     db ">ONE Homo sapiens alu", 10
header_one_len: equ $ - header_one
header_two:     db ">TWO IUB ambiguity codes", 10
header_two_len: equ $ - header_two
header_three:   db ">THREE Homo sapiens frequency", 10
header_three_len: equ $ - header_three

alu:            db ALU_1, ALU_2, ALU_3, ALU_4, ALU_5, ALU_6, ALU_7
alu_len:        equ $ - alu
                db ALU_1, ALU_2         ; first 84 bytes again: a line starting anywhere never wraps

iub_symbols:    db "acgtBDHKMNRSVWY"
iub_count:      equ $ - iub_symbols
align 8
iub_probs:      dq 0.27, 0.12, 0.12, 0.27
                times 11 dq 0.02        ; B D H K M N R S V W Y

hs_symbols:     db "acgt"
hs_count:       equ $ - hs_symbols
align 8
hs_probs:       dq 0.3029549426680, 0.1979883004921, 0.1975473066391, 0.3015094502008

im_double:      dq 139968.0

section .bss
outbuf:         resb BUF_SIZE           ; buffered stdout
cumulative:     resq MAX_ENTRIES        ; cumulative probabilities of the current table

section .text
global _start

; ---------------------------------------------------------------------------
; Entry point. Stack: [rsp] = argc, [rsp+8] = argv[0], [rsp+16] = argv[1].
; Registers kept for the whole run:
;   r12 = N   r13d = generator seed (shared by records TWO and THREE)
;   r15 = flush threshold (cursor limit)   rdi = write cursor into outbuf
; ---------------------------------------------------------------------------
_start:
    cmp     qword [rsp], 2              ; exactly one argument
    jne     usage_error
    mov     rsi, [rsp + 16]             ; rsi = argv[1]
    call    parse_count                 ; rax = N, CF = 1 on invalid input
    jc      usage_error

    mov     r12, rax
    mov     r13d, SEED
    lea     r15, [outbuf + BUF_SIZE - MAX_LINE]
    lea     rdi, [outbuf]

    ; Record ONE: the ALU string repeated cyclically, 2N characters.
    lea     rsi, [header_one]
    mov     ecx, header_one_len
    call    append_header
    lea     rbx, [r12 + r12]
    call    repeat_fasta

    ; Record TWO: 3N random symbols from the IUB table.
    lea     rsi, [header_two]
    mov     ecx, header_two_len
    call    append_header
    lea     rbx, [r12 + r12 * 2]
    lea     rsi, [iub_symbols]
    lea     rdx, [iub_probs]
    mov     ecx, iub_count
    call    random_fasta

    ; Record THREE: 5N random symbols from the Homo sapiens table; the seed carries over.
    lea     rsi, [header_three]
    mov     ecx, header_three_len
    call    append_header
    lea     rbx, [r12 + r12 * 4]
    lea     rsi, [hs_symbols]
    lea     rdx, [hs_probs]
    mov     ecx, hs_count
    call    random_fasta

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
; repeat_fasta: write rbx characters of the ALU string repeated cyclically,
; LINE_WIDTH per line. r8 = position in alu (0 .. alu_len - 1).
; Clobbers rax, rcx, rdx, rsi, r8, r11; rbx ends at 0.
; ---------------------------------------------------------------------------
repeat_fasta:
    xor     r8d, r8d

.line:
    test    rbx, rbx
    jz      .done
    call    begin_line                  ; rcx = line length, rbx -= rcx
    lea     rsi, [alu]
    add     rsi, r8                     ; source = alu + position (the extra copy covers the wrap)
    add     r8, rcx                     ; advance the position...
    rep     movsb                       ; copy the line; rdi advances
    mov     byte [rdi], 10
    inc     rdi
    cmp     r8, alu_len
    jb      .line
    sub     r8, alu_len                 ; ...modulo alu_len
    jmp     .line

.done:
    ret

; ---------------------------------------------------------------------------
; random_fasta: write rbx symbols drawn from a table, LINE_WIDTH per line.
; in: rsi = symbols, rdx = probabilities (doubles), ecx = entries (<= MAX_ENTRIES).
; Registers in the loop:
;   r8 = symbols   r9 = cumulative probabilities   r10d = index of the last entry
;   r13d = seed   r14 = end of the current line   xmm0 = r
; Clobbers rax, rcx, rdx, rsi, r8-r11, r14, xmm0; rbx ends at 0.
; ---------------------------------------------------------------------------
random_fasta:
    mov     r8, rsi
    lea     r9, [cumulative]
    lea     r10d, [rcx - 1]

    ; cumulative[i] = running double sum of probabilities[0..i], starting from 0.0.
    xorpd   xmm0, xmm0
    xor     eax, eax

.sum:
    addsd   xmm0, [rdx + rax * 8]
    movsd   [r9 + rax * 8], xmm0
    inc     eax
    cmp     eax, ecx
    jb      .sum

.line:
    test    rbx, rbx
    jz      .done
    call    begin_line                  ; rcx = line length, rbx -= rcx
    lea     r14, [rdi + rcx]            ; r14 = where this line's symbols end

.symbol:
    ; seed = (seed * IA + IC) mod IM, the quotient via reciprocal multiplication.
    imul    eax, r13d, IA
    add     eax, IC                     ; x = seed * IA + IC < 2^30 (upper half of rax is 0)
    imul    rdx, rax, IM_MAGIC
    shr     rdx, IM_SHIFT               ; rdx = x / IM
    imul    edx, edx, IM
    sub     eax, edx                    ; eax = x mod IM
    mov     r13d, eax

    ; r = seed / 139968.0, an IEEE double division like every other implementation.
    pxor    xmm0, xmm0                  ; breaks cvtsi2sd's false dependency on xmm0
    cvtsi2sd xmm0, eax
    divsd   xmm0, [im_double]

    ; First entry with r < cumulative[i]; the last entry is taken without a comparison
    ; (it is the answer both when r < cumulative[last] and when no entry matches).
    xor     ecx, ecx

.scan:
    cmp     ecx, r10d
    je      .pick
    comisd  xmm0, [r9 + rcx * 8]        ; CF = 1 when r < cumulative[i]
    jb      .pick
    inc     ecx
    jmp     .scan

.pick:
    movzx   eax, byte [r8 + rcx]
    mov     [rdi], al
    inc     rdi
    cmp     rdi, r14
    jb      .symbol

    mov     byte [rdi], 10              ; end of line
    inc     rdi
    jmp     .line

.done:
    ret

; ---------------------------------------------------------------------------
; begin_line: make room for one line and take its length from the characters left.
; in: rbx = characters left (> 0). out: rcx = min(LINE_WIDTH, rbx), rbx -= rcx.
; Clobbers rax, rdx, r11 (through flush).
; ---------------------------------------------------------------------------
begin_line:
    call    make_room
    mov     ecx, LINE_WIDTH
    cmp     rbx, rcx
    cmovb   rcx, rbx                    ; last line may be shorter
    sub     rbx, rcx
    ret

; ---------------------------------------------------------------------------
; append_header: copy the rcx-byte header line at rsi to the buffer.
; Clobbers rax, rcx, rdx, rsi, r11.
; ---------------------------------------------------------------------------
append_header:
    call    make_room
    rep     movsb                       ; copy [rsi] -> [rdi], rdi += rcx
    ret

; ---------------------------------------------------------------------------
; make_room: flush when the buffer may not fit another MAX_LINE bytes.
; Clobbers rax, rdx, r11 (through flush).
; ---------------------------------------------------------------------------
make_room:
    cmp     rdi, r15
    jae     flush                       ; tail call: flush returns to our caller
    ret

; ---------------------------------------------------------------------------
; flush: write outbuf[0 .. rdi) to stdout, retrying on partial writes.
; out: rdi = outbuf. Preserves rcx and rsi; clobbers rax, rdx, r11.
; ---------------------------------------------------------------------------
flush:
    push    rcx
    push    rsi
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
    pop     rsi
    pop     rcx
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
