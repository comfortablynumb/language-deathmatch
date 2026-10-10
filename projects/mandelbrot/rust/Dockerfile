FROM rust:1.99-alpine3.24 AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked && cp target/release/mandelbrot /mandelbrot

FROM scratch
COPY --from=build /mandelbrot /app/mandelbrot
ENTRYPOINT ["/app/mandelbrot"]
