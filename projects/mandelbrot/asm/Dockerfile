FROM alpine:3.24 AS build
RUN apk add --no-cache nasm binutils
WORKDIR /src
COPY mandelbrot.asm ./
RUN nasm -f elf64 -o mandelbrot.o mandelbrot.asm && ld -s -o /mandelbrot mandelbrot.o

FROM scratch
COPY --from=build /mandelbrot /app/mandelbrot
ENTRYPOINT ["/app/mandelbrot"]
