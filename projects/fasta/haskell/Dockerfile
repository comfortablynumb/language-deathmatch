FROM haskell:9.14 AS build
WORKDIR /src
COPY Main.hs ./
RUN ghc -O2 -static -optl-static -optl-pthread -o /fasta Main.hs && strip /fasta

FROM scratch
COPY --from=build /fasta /app/fasta
ENTRYPOINT ["/app/fasta"]
