FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.cpp ./
RUN g++ -std=c++23 -O2 -static -s -o /primes-sieve main.cpp

FROM scratch
COPY --from=build /primes-sieve /app/primes-sieve
ENTRYPOINT ["/app/primes-sieve"]
