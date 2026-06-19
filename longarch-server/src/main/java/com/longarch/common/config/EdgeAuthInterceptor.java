package com.longarch.common.config;

import com.longarch.common.exception.BizException;
import com.longarch.common.enums.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * S-01: Edge HTTP 接口共享密钥校验。
 * 仅当配置了 edge.api.token 时启用（默认空 = 关闭，内网/本地不受影响）。
 * 启用后 /api/v1/edge/** 必须携带匹配的 X-Edge-Token 头，否则拒绝。
 */
@Component
public class EdgeAuthInterceptor implements HandlerInterceptor {

    @Value("${edge.api.token:}")
    private String edgeToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!StringUtils.hasText(edgeToken)) {
            return true;
        }
        String provided = request.getHeader("X-Edge-Token");
        if (!edgeToken.equals(provided)) {
            throw new BizException(ErrorCode.UNAUTHORIZED, "边缘节点鉴权失败");
        }
        return true;
    }
}
