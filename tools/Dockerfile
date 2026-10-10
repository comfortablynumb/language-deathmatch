# Builds the in-container benchmark harness (linux/amd64):
#   ldmmeasure  Go harness: verification run, warmups, timed runs, JSON report
#   ldmexec     tiny static C launcher that measures one run exactly (see ldmexec/ldmexec.c)
#
# Exported to the host by `ldm bench`:
#   docker build --target harness --output type=local,dest=build/harness tools

FROM golang:1.27-alpine3.24 AS ldmmeasure
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ldmmeasure ./cmd/ldmmeasure

FROM alpine:3.24 AS ldmexec
RUN apk add --no-cache gcc musl-dev
COPY ldmexec/ldmexec.c /src/ldmexec.c
RUN mkdir -p /out && gcc -std=c17 -O2 -Wall -Wextra -Werror -static -s -o /out/ldmexec /src/ldmexec.c

FROM scratch AS harness
COPY --from=ldmmeasure /out/ldmmeasure /ldmmeasure
COPY --from=ldmexec /out/ldmexec /ldmexec
