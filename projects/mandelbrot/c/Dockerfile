FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.c ./
RUN gcc -std=c23 -O2 -ffp-contract=off -static -s -o /mandelbrot main.c

FROM scratch
COPY --from=build /mandelbrot /app/mandelbrot
ENTRYPOINT ["/app/mandelbrot"]
