FROM alpine:3.24 AS build
RUN apk add --no-cache git make gcc musl-dev
# V 0.5.2 from its git tag. make would pull the latest vc (V's C bootstrap) and tccbin, so both are
# pinned to the commits matching the tag (vc 7eb8c54 = V 45ae01d, the tag's parent; the tag only
# adds the changelog) and make runs with local=1.
RUN git clone --depth 1 --branch 0.5.2 https://github.com/vlang/v /opt/v \
 && git init -q /opt/v/vc \
 && git -C /opt/v/vc fetch -q --depth 1 https://github.com/vlang/vc 7eb8c54a3843e5107d5af06d7a8c3e928f322475 \
 && git -C /opt/v/vc checkout -q FETCH_HEAD \
 && git init -q /opt/v/thirdparty/tcc \
 && git -C /opt/v/thirdparty/tcc fetch -q --depth 1 https://github.com/vlang/tccbin a3e24da26ec42a005d6990618d20d5d955ff4a0b \
 && git -C /opt/v/thirdparty/tcc checkout -q FETCH_HEAD \
 && make -C /opt/v local=1
WORKDIR /src
COPY main.v ./
RUN /opt/v/v -prod -cflags "-static -s -ffp-contract=off" -o /mandelbrot main.v

FROM scratch
COPY --from=build /mandelbrot /app/mandelbrot
ENTRYPOINT ["/app/mandelbrot"]
