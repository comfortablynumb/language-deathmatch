FROM alpine:3.24 AS build
RUN apk add --no-cache zig=0.16.0-r1
WORKDIR /src
COPY main.zig ./
RUN zig build-exe -O ReleaseFast -fstrip -mcpu baseline -femit-bin=/primes-sieve main.zig

FROM scratch
COPY --from=build /primes-sieve /app/primes-sieve
ENTRYPOINT ["/app/primes-sieve"]
