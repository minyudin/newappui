package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum RoleType {

    ADOPTER("adopter", "认养用户"),
    GUEST("guest", "游客/分享访问者"),
    ADMIN("admin", "平台管理员"),
    OPERATOR("operator", "农场运营人员"),
    AGRONOMIST("agronomist", "农技人员"),
    AI_AGENT("ai_agent", "AI代理账号"),
    EDGE_NODE("edge_node", "边缘节点账号");

    private final String value;
    private final String label;
}
