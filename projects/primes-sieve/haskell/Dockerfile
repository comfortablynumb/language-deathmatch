FROM haskell:9.14 AS build
WORKDIR /src
COPY Main.hs ./
RUN ghc -O2 -static -optl-static -optl-pthread -o /primes-sieve Main.hs && strip /primes-sieve

FROM scratch
COPY --from=build /primes-sieve /app/primes-sieve
ENTRYPOINT ["/app/primes-sieve"]
