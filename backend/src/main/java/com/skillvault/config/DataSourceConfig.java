package com.skillvault.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URISyntaxException;

@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${spring.datasource.url:}")
    private String springDatasourceUrl;

    @Value("${spring.datasource.username:}")
    private String defaultUsername;

    @Value("${spring.datasource.password:}")
    private String defaultPassword;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        // 1. Check cloud URI environment variables (Render / Railway / Neon inject DATABASE_URL or POSTGRES_URL)
        String rawDatabaseUrl = getFirstNonBlank(
                System.getenv("DATABASE_URL"),
                System.getenv("POSTGRES_URL"),
                System.getenv("NEON_DATABASE_URL")
        );

        // 2. Check explicit JDBC url environment variables
        String explicitJdbcUrl = getFirstNonBlank(
                System.getenv("SPRING_DATASOURCE_URL"),
                System.getenv("JDBC_DATABASE_URL"),
                springDatasourceUrl
        );

        if (rawDatabaseUrl != null && !rawDatabaseUrl.isBlank()) {
            log.info("Configuring DataSource from environment DATABASE_URL...");
            if (rawDatabaseUrl.startsWith("jdbc:")) {
                config.setJdbcUrl(rawDatabaseUrl);
            } else {
                try {
                    URI uri = new URI(rawDatabaseUrl.replace("postgres://", "postgresql://"));
                    String host = uri.getHost();
                    int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                    String path = uri.getPath();
                    String query = uri.getQuery();

                    String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path;
                    if (query != null && !query.isBlank()) {
                        jdbcUrl += "?" + query;
                    }
                    config.setJdbcUrl(jdbcUrl);

                    String userInfo = uri.getUserInfo();
                    if (userInfo != null) {
                        String[] parts = userInfo.split(":", 2);
                        config.setUsername(parts[0]);
                        if (parts.length > 1) {
                            config.setPassword(parts[1]);
                        }
                    }
                } catch (URISyntaxException e) {
                    log.warn("Failed to parse raw URI, using raw URL: {}", e.getMessage());
                    config.setJdbcUrl(rawDatabaseUrl);
                }
            }
        } else if (explicitJdbcUrl != null && !explicitJdbcUrl.isBlank()) {
            log.info("Configuring DataSource from explicit JDBC URL...");
            config.setJdbcUrl(explicitJdbcUrl);
            String user = getFirstNonBlank(System.getenv("SPRING_DATASOURCE_USERNAME"), defaultUsername, "postgres");
            String pass = getFirstNonBlank(System.getenv("SPRING_DATASOURCE_PASSWORD"), defaultPassword, "0000");
            config.setUsername(user);
            config.setPassword(pass);
        } else {
            // Local fallback
            log.info("Using local default PostgreSQL configuration...");
            config.setJdbcUrl("jdbc:postgresql://localhost:5432/Skill-Vault");
            config.setUsername(getFirstNonBlank(defaultUsername, "postgres"));
            config.setPassword(getFirstNonBlank(defaultPassword, "0000"));
        }

        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setIdleTimeout(30000);
        config.setConnectionTimeout(30000);

        return new HikariDataSource(config);
    }

    private String getFirstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }
}
