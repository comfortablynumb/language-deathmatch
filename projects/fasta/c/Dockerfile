FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.c ./
RUN gcc -std=c23 -O2 -static -s -o /fasta main.c

FROM scratch
COPY --from=build /fasta /app/fasta
ENTRYPOINT ["/app/fasta"]
