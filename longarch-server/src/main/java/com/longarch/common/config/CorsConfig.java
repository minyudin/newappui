package com.longarch.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    /**
     * S-04: 允许的来源白名单（逗号分隔）。为空时退回开发态通配（"*"，且不带凭证），
     * 生产应配置具体域名（cors.allowed-origins=https://admin.example.com,...）以配合凭证使用。
     */
    @Value("${cors.allowed-origins:}")
    private String allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedHeader("*");
        config.addAllowedMethod("*");
        config.setMaxAge(3600L);

        if (StringUtils.hasText(allowedOrigins)) {
            List<String> origins = Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .toList();
            origins.forEach(config::addAllowedOrigin);
            // 仅在显式白名单下开启凭证，避免 "*" + credentials 的不安全组合
            config.setAllowCredentials(true);
        } else {
            // 未配置白名单（dev/本地）：通配但不带凭证，浏览器规范禁止 "*" 同时携带凭证
            config.addAllowedOriginPattern("*");
            config.setAllowCredentials(false);
        }

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
