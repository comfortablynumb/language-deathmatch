FROM haskell:9.14 AS build
WORKDIR /src
COPY Main.hs ./
RUN ghc -O2 -static -optl-static -optl-pthread -o /mandelbrot Main.hs && strip /mandelbrot

FROM scratch
COPY --from=build /mandelbrot /app/mandelbrot
ENTRYPOINT ["/app/mandelbrot"]
