; Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).
; x86-64 Linux, NASM syntax, no libc: raw syscalls, a hand-managed output buffer, and tree
; nodes carved with a bump pointer from mmap'd arenas (there is no malloc to call).

BITS 64
DEFAULT REL

%define SYS_WRITE       1
%define SYS_MMAP        9
%define SYS_MUNMAP      11
%define SYS_EXIT        60
%define STDOUT          1
%define STDERR          2
%define PROT_RW         3                   ; PROT_READ | PROT_WRITE
%define MAP_ANON_PRIV   0x22                ; MAP_PRIVATE | MAP_ANONYMOUS
%define MIN_DEPTH       4
%define MAX_INPUT       21
%define NODE_SHIFT      4                   ; a node is 16 bytes: left pointer, right pointer
%define NODE_SIZE       (1 << NODE_SHIFT)
%define BUF_SIZE        4096                ; the whole output is < 1 KiB: one write at the end
%define DIGITS_SIZE     20                  ; decimal digits of 2^64 - 1

; An arena is one anonymous mapping that holds one tree at a time.
struc arena
    .base:  resq 1                          ; first byte of the mapping
    .bytes: resq 1                          ; length of the mapping
endstruc

; PUT label: append the constant string `label` (`label_len` bytes) to the output.
%macro PUT 1
    lea     rsi, [%1]
    mov     ecx, %1_len
    call    put_str
%endmacro

section .rodata
usage:              db "usage: binary-trees N  (N: 0..21)", 10
usage_len:          equ $ - usage
oom:                db "binary-trees: out of memory", 10
oom_len:            equ $ - oom
stretch_msg:        db "stretch tree of depth "
stretch_msg_len:    equ $ - stretch_msg
trees_msg:          db 9, " trees of depth "
trees_msg_len:      equ $ - trees_msg
long_msg:           db "long lived tree of depth "
long_msg_len:       equ $ - long_msg
check_msg:          db 9, " check: "
check_msg_len:      equ $ - check_msg

section .bss
outbuf:             resb BUF_SIZE           ; buffered stdout
digits:             resb DIGITS_SIZE        ; scratch space for one number
work_arena:         resb arena_size         ; short-lived trees: stretch, then iterations
long_arena:         resb arena_size         ; the long-lived tree

section .text
global _start

; ---------------------------------------------------------------------------
; Entry point. Stack: [rsp] = argc, [rsp+8] = argv[0], [rsp+16] = argv[1].
; Registers kept for the whole run:
;   r12 = maxDepth   r13 = current iteration depth   r14 = long-lived root
;   r15 = output cursor into outbuf   rbx = arena bump pointer (next free node)
; ---------------------------------------------------------------------------
_start:
    cmp     qword [rsp], 2              ; exactly one argument
    jne     usage_error
    mov     rsi, [rsp + 16]             ; rsi = argv[1]
    call    parse_depth                 ; rax = N, CF = 1 on invalid input
    jc      usage_error

    mov     r12d, MIN_DEPTH + 2
    cmp     r12, rax
    cmovb   r12, rax                    ; r12 = maxDepth = max(MIN_DEPTH + 2, N)
    lea     r15, [outbuf]

    call    stretch_line                ; stretch tree: built, checked, dropped
    call    build_long_lived            ; r14 = long-lived tree, alive until the end
    call    depth_lines                 ; every short-lived tree, one line per depth
    call    long_lived_line             ; finally walk the long-lived tree

    call    flush
    xor     edi, edi                    ; exit code 0
    jmp     exit                        ; the kernel unmaps the long-lived arena

; ---------------------------------------------------------------------------
; parse_depth: parse the NUL-terminated string at rsi as a decimal number.
; out: rax = value; CF = 1 if empty, has a non-digit, or exceeds MAX_INPUT.
; ---------------------------------------------------------------------------
parse_depth:
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
    cmp     rax, MAX_INPUT
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
; stretch_line: map an arena for one tree of depth maxDepth + 1, build and walk
; the tree, unmap the arena (dropping the tree), then print
; "stretch tree of depth {maxDepth + 1}\t check: {count}\n".
; ---------------------------------------------------------------------------
stretch_line:
    lea     rdi, [work_arena]
    lea     esi, [r12 + 1]
    call    arena_map
    lea     rdi, [work_arena]
    lea     esi, [r12 + 1]
    call    build                       ; rax = root
    mov     rdi, rax
    call    check                       ; rax = node count
    mov     r13, rax                    ; r13 is free until depth_lines starts
    lea     rdi, [work_arena]
    call    arena_unmap                 ; drop the stretch tree

    PUT     stretch_msg
    lea     eax, [r12 + 1]
    call    put_u64
    mov     rax, r13
    jmp     put_check                   ; tail call: "\t check: {count}\n"

; ---------------------------------------------------------------------------
; build_long_lived: map the long-lived arena and build a tree of depth maxDepth
; in it. out: r14 = root (the arena is never reused, so the tree stays alive).
; ---------------------------------------------------------------------------
build_long_lived:
    lea     rdi, [long_arena]
    mov     esi, r12d
    call    arena_map
    lea     rdi, [long_arena]
    mov     esi, r12d
    call    build
    mov     r14, rax
    ret

; ---------------------------------------------------------------------------
; depth_lines: map one arena sized for a tree of depth maxDepth, reused by every
; short-lived tree; print one line per depth = MIN_DEPTH, MIN_DEPTH + 2, …,
; ≤ maxDepth (maxDepth ≥ MIN_DEPTH + 2, so at least two); then unmap the arena.
; ---------------------------------------------------------------------------
depth_lines:
    lea     rdi, [work_arena]
    mov     esi, r12d
    call    arena_map
    mov     r13d, MIN_DEPTH

.depth:
    call    depth_line
    add     r13d, 2
    cmp     r13d, r12d
    jbe     .depth

    lea     rdi, [work_arena]
    jmp     arena_unmap                 ; tail call

; ---------------------------------------------------------------------------
; depth_line: build, walk and drop 2^(maxDepth - depth + MIN_DEPTH) trees of
; depth r13 one at a time in the work arena, then print
; "{iterations}\t trees of depth {depth}\t check: {sum}\n".
;   rbp = trees left to build   r14 = sum of the checks (both saved and restored)
; ---------------------------------------------------------------------------
depth_line:
    push    rbp
    push    r14
    call    iterations
    mov     ebp, eax
    xor     r14d, r14d

.tree:
    lea     rdi, [work_arena]
    mov     esi, r13d
    call    build                       ; rax = root; reusing the arena drops the previous tree
    mov     rdi, rax
    call    check
    add     r14, rax
    dec     ebp
    jnz     .tree

    call    iterations
    call    put_u64                     ; "{iterations}"
    PUT     trees_msg                   ; "\t trees of depth "
    mov     eax, r13d
    call    put_u64                     ; "{depth}"
    mov     rax, r14
    call    put_check                   ; "\t check: {sum}\n"
    pop     r14
    pop     rbp
    ret

; ---------------------------------------------------------------------------
; iterations: eax = 2^(maxDepth - depth + MIN_DEPTH) for r12 = maxDepth and
; r13 = depth. Clobbers rcx.
; ---------------------------------------------------------------------------
iterations:
    mov     ecx, r12d
    sub     ecx, r13d
    add     ecx, MIN_DEPTH
    mov     eax, 1
    shl     eax, cl
    ret

; ---------------------------------------------------------------------------
; long_lived_line: walk the long-lived tree at r14 and print
; "long lived tree of depth {maxDepth}\t check: {count}\n".
; ---------------------------------------------------------------------------
long_lived_line:
    PUT     long_msg
    mov     eax, r12d
    call    put_u64
    mov     rdi, r14
    call    check                       ; rax = node count
    jmp     put_check                   ; tail call

; ---------------------------------------------------------------------------
; arena_map: map an anonymous, zero-filled region that fits one tree of depth
; esi (2^(depth+1) - 1 nodes) and record it in the arena at rdi.
; Exits through memory_error if the kernel refuses.
; Clobbers rax, rcx, rdx, rsi, r8, r9, r10, r11 (rdi is preserved).
; ---------------------------------------------------------------------------
arena_map:
    lea     ecx, [rsi + 1]
    mov     eax, 1
    shl     rax, cl
    dec     rax                         ; rax = nodes in a perfect tree of that depth
    shl     rax, NODE_SHIFT             ; rax = bytes
    mov     [rdi + arena.bytes], rax
    push    rdi
    mov     rsi, rax                    ; length
    xor     edi, edi                    ; address: let the kernel choose
    mov     edx, PROT_RW
    mov     r10d, MAP_ANON_PRIV
    mov     r8, -1                      ; no file descriptor
    xor     r9d, r9d                    ; offset 0
    mov     eax, SYS_MMAP
    syscall                             ; rax = address or -errno
    pop     rdi
    cmp     rax, -4095
    jae     memory_error                ; -4095..-1 are error codes
    mov     [rdi + arena.base], rax
    ret

; ---------------------------------------------------------------------------
; arena_unmap: give the arena at rdi (and the tree in it) back to the kernel.
; Clobbers rax, rcx, rsi, rdi, r11.
; ---------------------------------------------------------------------------
arena_unmap:
    mov     rsi, [rdi + arena.bytes]
    mov     rdi, [rdi + arena.base]
    mov     eax, SYS_MUNMAP
    syscall
    ret

; ---------------------------------------------------------------------------
; build: build a tree of depth esi in the arena at rdi. Allocation restarts at
; the arena base, which releases the tree previously built there.
; out: rax = root. Clobbers rcx, rdi, rbx.
; ---------------------------------------------------------------------------
build:
    mov     rbx, [rdi + arena.base]     ; reset the bump pointer
    mov     edi, esi
    jmp     bottom_up_tree              ; tail call

; ---------------------------------------------------------------------------
; bottom_up_tree: build a perfect tree of depth edi from the bump pointer rbx,
; children before their parent, one 16-byte node per allocation.
; out: rax = root; rbx advanced by NODE_SIZE per node. Clobbers rcx, rdi.
; ---------------------------------------------------------------------------
bottom_up_tree:
    test    edi, edi
    jz      .leaf
    push    r12                         ; r12 = left child   (callee-saved)
    push    r13                         ; r13 = child depth  (callee-saved)
    lea     r13d, [rdi - 1]
    mov     edi, r13d
    call    bottom_up_tree
    mov     r12, rax                    ; left = tree(depth - 1)
    mov     edi, r13d
    call    bottom_up_tree              ; rax = right = tree(depth - 1)
    mov     [rbx], r12                  ; node.left
    mov     [rbx + 8], rax              ; node.right
    mov     rax, rbx                    ; allocate: take the bump pointer...
    add     rbx, NODE_SIZE              ; ...and advance it
    pop     r13
    pop     r12
    ret

.leaf:
    xor     ecx, ecx
    mov     [rbx], rcx                  ; no children: both pointers null
    mov     [rbx + 8], rcx              ; (the arena may hold an old tree's bytes)
    mov     rax, rbx
    add     rbx, NODE_SIZE
    ret

; ---------------------------------------------------------------------------
; check: walk the tree at rdi and return its node count in rax
; (1 for a leaf, 1 + check(left) + check(right) otherwise). Clobbers rdi.
; ---------------------------------------------------------------------------
check:
    cmp     qword [rdi], 0
    je      .leaf                       ; a leaf has no left (nor right) child
    push    r12                         ; r12 = count of the left subtree (callee-saved)
    push    qword [rdi + 8]             ; right child, needed after the left walk
    mov     rdi, [rdi]
    call    check
    mov     r12, rax                    ; r12 = check(left)
    pop     rdi
    call    check                       ; rax = check(right)
    lea     rax, [r12 + rax + 1]
    pop     r12
    ret

.leaf:
    mov     eax, 1
    ret

; ---------------------------------------------------------------------------
; put_str: append rcx bytes from rsi at the output cursor r15.
; Clobbers rcx, rsi, rdi.
; ---------------------------------------------------------------------------
put_str:
    mov     rdi, r15
    rep     movsb                       ; copy [rsi] -> [rdi], rdi += rcx
    mov     r15, rdi
    ret

; ---------------------------------------------------------------------------
; put_u64: append rax in decimal at the output cursor r15. Only a few dozen
; numbers are printed, so a plain div is fine. Clobbers rax, rcx, rdx, rsi, rdi, r8.
; ---------------------------------------------------------------------------
put_u64:
    lea     rsi, [digits + DIGITS_SIZE] ; digits are built backwards from the end
    mov     r8d, 10

.digit:
    xor     edx, edx
    div     r8                          ; rax = x / 10, rdx = x % 10
    add     dl, '0'
    dec     rsi
    mov     [rsi], dl
    test    rax, rax
    jnz     .digit

    lea     rcx, [digits + DIGITS_SIZE]
    sub     rcx, rsi                    ; rcx = digit count
    jmp     put_str                     ; tail call: copy them out

; ---------------------------------------------------------------------------
; put_check: append "\t check: {rax}\n". Clobbers rax, rcx, rdx, rsi, rdi, r8.
; ---------------------------------------------------------------------------
put_check:
    PUT     check_msg                   ; leaves rax intact
    call    put_u64
    mov     byte [r15], 10              ; '\n'
    inc     r15
    ret

; ---------------------------------------------------------------------------
; flush: write outbuf[0 .. r15) to stdout, retrying on partial writes.
; out: r15 = outbuf. Clobbers rax, rcx, rdx, rsi, rdi, r11.
; ---------------------------------------------------------------------------
flush:
    lea     rsi, [outbuf]               ; rsi = first pending byte
    mov     rdx, r15
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
    lea     r15, [outbuf]
    ret

; ---------------------------------------------------------------------------
; Exit paths: an error message on stderr, then exit code 1.
; ---------------------------------------------------------------------------
usage_error:
    lea     rsi, [usage]
    mov     edx, usage_len
    jmp     fail

memory_error:
    lea     rsi, [oom]
    mov     edx, oom_len

fail:
    mov     eax, SYS_WRITE
    mov     edi, STDERR
    syscall

write_error:
    mov     edi, 1                      ; exit code 1

exit:
    mov     eax, SYS_EXIT
    syscall
