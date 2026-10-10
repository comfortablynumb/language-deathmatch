FROM haskell:9.14 AS build
WORKDIR /src
COPY Main.hs ./
RUN ghc -O2 -static -optl-static -optl-pthread -o /fibonacci Main.hs && strip /fibonacci

FROM scratch
COPY --from=build /fibonacci /app/fibonacci
ENTRYPOINT ["/app/fibonacci"]
