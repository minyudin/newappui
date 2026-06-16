package com.longarch.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class Knife4jConfig {

    private final BusinessDefaultsProperties bizDefaults;

    @Bean
    public OpenAPI openAPI() {
        String name = bizDefaults.getPlatformName();
        return new OpenAPI()
                .info(new Info()
                        .title(name + "后端 API")
                        .description(name + "后端接口文档")
                        .version("1.0.0"));
    }
}
