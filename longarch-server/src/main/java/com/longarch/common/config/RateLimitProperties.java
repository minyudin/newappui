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
    /** 游客登录（公开，按 IP） */
    private Rule guestLogin = new Rule(30, 60);
    /** 认养码校验（公开，按 IP） */
    private Rule adoptionCodeVerify = new Rule(30, 60);
    /** 昵称可用性校验（公开，按 IP） */
    private Rule checkNickname = new Rule(60, 60);
    /** AI 调用（登录态，按用户）——AI 走外网智谱、最贵，限得更紧 */
    private Rule aiInvoke = new Rule(20, 60);

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

