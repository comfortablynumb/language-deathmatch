FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.c ./
RUN gcc -std=c23 -O2 -static -s -o /binary-trees main.c

FROM scratch
COPY --from=build /binary-trees /app/binary-trees
ENTRYPOINT ["/app/binary-trees"]
