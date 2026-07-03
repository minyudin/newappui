# syntax=docker/dockerfile:1
# 后端 Spring Boot（JDK 17）
# 构建：docker build -t longarch-server .
# 运行：docker run --rm -p 8081:8081 --env-file ../.env longarch-server

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# 国内阿里云 Maven 镜像，加速依赖下载
COPY settings.xml /root/.m2/settings.xml

# 先解析依赖并缓存（利用 BuildKit 缓存 + 层缓存）
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2/repository \
    mvn -q -s /root/.m2/settings.xml -DskipTests dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2/repository \
    mvn -q -s /root/.m2/settings.xml -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

# S-06: 生产镜像默认 prod profile，裸 docker run 不会误用 dev 配置；
# docker-compose 通过 environment 显式覆盖（本地仍为 dev）。
ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
