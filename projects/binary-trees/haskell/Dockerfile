FROM haskell:9.14 AS build
WORKDIR /src
COPY Main.hs ./
RUN ghc -O2 -static -optl-static -optl-pthread -o /binary-trees Main.hs && strip /binary-trees

FROM scratch
COPY --from=build /binary-trees /app/binary-trees
ENTRYPOINT ["/app/binary-trees"]
