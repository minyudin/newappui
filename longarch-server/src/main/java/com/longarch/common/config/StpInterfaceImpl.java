package com.longarch.common.config;

import cn.dev33.satoken.stp.StpInterface;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

/**
 * Sa-Token 权限/角色认证接口实现
 */
@Component
public class StpInterfaceImpl implements StpInterface {

    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        // 暂不做细粒度权限，预留扩展
        return Collections.emptyList();
    }

    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        String roleType = (String) StpUtil.getSessionByLoginId(loginId).get("roleType");
        if (roleType == null) {
            return Collections.emptyList();
        }
        return List.of(roleType);
    }
}
