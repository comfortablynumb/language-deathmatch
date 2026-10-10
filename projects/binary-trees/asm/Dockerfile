FROM alpine:3.24 AS build
RUN apk add --no-cache nasm binutils
WORKDIR /src
COPY binary-trees.asm ./
RUN nasm -f elf64 -o binary-trees.o binary-trees.asm && ld -s -o /binary-trees binary-trees.o

FROM scratch
COPY --from=build /binary-trees /app/binary-trees
ENTRYPOINT ["/app/binary-trees"]
