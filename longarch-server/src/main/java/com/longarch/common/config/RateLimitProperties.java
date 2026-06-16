package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "longarch.rate-limit")
public class RateLimitProperties {

    /** master switch */
    private boolean enabled = true;

    private Rule wechatLogin = new Rule(60, 60);
    private Rule adminLogin = new Rule(30, 60);
    private Rule createTask = new Rule(60, 60);
    private Rule createAdoptionCode = new Rule(30, 60);

    @Data
    public static class Rule {
        /** max requests in window */
        private int limit;
        /** window size in seconds */
        private int windowSeconds;

        public Rule() {}

        public Rule(int limit, int windowSeconds) {
            this.limit = limit;
            this.windowSeconds = windowSeconds;
        }
    }
}

