FROM golang:1.27-alpine3.24 AS build
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/primes-sieve .

FROM scratch
COPY --from=build /out/primes-sieve /app/primes-sieve
ENTRYPOINT ["/app/primes-sieve"]
