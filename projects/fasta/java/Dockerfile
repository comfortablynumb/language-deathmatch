FROM eclipse-temurin:25-jdk-alpine AS build
WORKDIR /src
COPY Main.java ./
RUN javac --release 25 -d /out Main.java

FROM eclipse-temurin:25-jre-alpine
COPY --from=build /out /app
ENTRYPOINT ["java", "-cp", "/app", "Main"]
