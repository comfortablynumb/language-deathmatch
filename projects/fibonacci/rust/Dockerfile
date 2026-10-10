FROM rust:1.99-alpine3.24 AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked && cp target/release/fibonacci /fibonacci

FROM scratch
COPY --from=build /fibonacci /app/fibonacci
ENTRYPOINT ["/app/fibonacci"]
