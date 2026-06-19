# 后端 Spring Boot（JDK 17）
# 构建：docker build -t longarch-server .
# 运行：docker run --rm -p 8081:8081 --env-file ../.env longarch-server

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

# S-06: 生产镜像默认 prod profile，裸 docker run 不会误用 dev 配置；
# docker-compose 通过 environment 显式覆盖（本地仍为 dev）。
ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
