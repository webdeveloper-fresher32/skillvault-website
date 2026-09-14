FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline -B
COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/skillvault-backend-0.0.1-SNAPSHOT.jar app.jar
COPY ../content /content
ENV CONTENT_PATH=/content
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
