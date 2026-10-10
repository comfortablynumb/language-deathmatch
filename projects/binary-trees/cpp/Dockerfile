FROM gcc:16.2-trixie AS build
WORKDIR /src
COPY main.cpp ./
RUN g++ -std=c++23 -O2 -static -s -o /binary-trees main.cpp

FROM scratch
COPY --from=build /binary-trees /app/binary-trees
ENTRYPOINT ["/app/binary-trees"]
