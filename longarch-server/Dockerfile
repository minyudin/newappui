# 后端 Spring Boot（JDK 17）
# 构建：docker build -t longarch-server .
# 运行：docker run --rm -p 8080:8080 --env-file ../.env longarch-server

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
