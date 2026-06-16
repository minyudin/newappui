package com.longarch.common.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SaTokenConfig implements WebMvcConfigurer {

    private final WechatMiniProperties wechatMiniProperties;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        List<String> excludes = new ArrayList<>(List.of(
                "/api/v1/auth/wechat-login",
                "/api/v1/auth/guest-login",
                "/api/v1/auth/admin-login",
                "/api/v1/auth/check-nickname",
                "/api/v1/adoption-codes/verify",
                "/api/v1/edge/**",
                "/api/v1/screen/**",
                "/api/v1/dashboard/**",
                "/api/v1/public/**",
                "/doc.html",
                "/swagger-resources/**",
                "/v3/api-docs/**",
                "/webjars/**"
        ));
        if (wechatMiniProperties.isStubMode()) {
            excludes.add("/api/v1/auth/dev-login");
        }

        registry.addInterceptor(new SaInterceptor())
                .addPathPatterns("/api/**")
                .excludePathPatterns(excludes);
    }
}
