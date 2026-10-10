FROM rust:1.99-alpine3.24 AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked && cp target/release/primes-sieve /primes-sieve

FROM scratch
COPY --from=build /primes-sieve /app/primes-sieve
ENTRYPOINT ["/app/primes-sieve"]
