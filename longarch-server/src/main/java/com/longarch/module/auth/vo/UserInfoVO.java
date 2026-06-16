package com.longarch.module.auth.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class UserInfoVO {

    private Long userId;
    private String userNo;
    private String nickname;
    private String realName;
    private String mobile;
    private String avatarUrl;
    private String roleType;
    private Integer status;
    private Boolean bindMobile;
    /**
     * 是否已设置昵称 · 等价于 user.nickname IS NOT NULL.
     * 前端用此字段判断是否需要把用户跳到"补昵称"页 (强制注册流程).
     */
    private Boolean bindNickname;

    private RoleProfile roleProfile;
    private Map<String, Boolean> permissions;
    private List<String> menuScopes;

    @Data
    public static class RoleProfile {
        private String roleName;
        private String roleDesc;
    }
}
