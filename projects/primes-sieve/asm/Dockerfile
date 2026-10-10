FROM alpine:3.24 AS build
RUN apk add --no-cache nasm binutils
WORKDIR /src
COPY primes-sieve.asm ./
RUN nasm -f elf64 -o primes-sieve.o primes-sieve.asm && ld -s -o /primes-sieve primes-sieve.o

FROM scratch
COPY --from=build /primes-sieve /app/primes-sieve
ENTRYPOINT ["/app/primes-sieve"]
