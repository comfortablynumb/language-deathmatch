FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.cpp ./
RUN g++ -std=c++23 -O2 -static -s -o /fasta main.cpp

FROM scratch
COPY --from=build /fasta /app/fasta
ENTRYPOINT ["/app/fasta"]
