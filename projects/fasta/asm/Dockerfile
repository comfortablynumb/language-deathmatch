FROM alpine:3.24 AS build
RUN apk add --no-cache nasm binutils
WORKDIR /src
COPY fasta.asm ./
RUN nasm -f elf64 -o fasta.o fasta.asm && ld -s -o /fasta fasta.o

FROM scratch
COPY --from=build /fasta /app/fasta
ENTRYPOINT ["/app/fasta"]
