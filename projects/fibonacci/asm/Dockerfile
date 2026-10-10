FROM alpine:3.24 AS build
RUN apk add --no-cache nasm binutils
WORKDIR /src
COPY fibonacci.asm ./
RUN nasm -f elf64 -o fibonacci.o fibonacci.asm && ld -s -o /fibonacci fibonacci.o

FROM scratch
COPY --from=build /fibonacci /app/fibonacci
ENTRYPOINT ["/app/fibonacci"]
