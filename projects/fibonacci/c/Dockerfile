FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.c ./
RUN gcc -std=c23 -O2 -static -s -o /fibonacci main.c

FROM scratch
COPY --from=build /fibonacci /app/fibonacci
ENTRYPOINT ["/app/fibonacci"]
