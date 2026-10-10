FROM golang:1.27-alpine3.24 AS build
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/fibonacci .

FROM scratch
COPY --from=build /out/fibonacci /app/fibonacci
ENTRYPOINT ["/app/fibonacci"]
