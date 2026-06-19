package com.longarch.common.util;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 从当前 HTTP 请求解析客户端 IP（尽力而为，拿不到返回 "unknown"）。
 * 公开接口的限流键以 IP 维度构建，故抽出此工具复用，避免各处重复实现。
 */
public final class ClientIpUtil {

    private ClientIpUtil() {
    }

    /** 解析客户端 IP；优先 X-Forwarded-For 首段，回退 remoteAddr，最终回退 "unknown"。 */
    public static String resolve() {
        try {
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes sra) {
                HttpServletRequest request = sra.getRequest();
                String forwarded = request.getHeader("X-Forwarded-For");
                if (forwarded != null && !forwarded.isBlank()) {
                    return forwarded.split(",")[0].trim();
                }
                String remote = request.getRemoteAddr();
                if (remote != null && !remote.isBlank()) {
                    return remote;
                }
            }
        } catch (Exception ignored) {
            // 取不到 IP 不影响主流程
        }
        return "unknown";
    }
}
