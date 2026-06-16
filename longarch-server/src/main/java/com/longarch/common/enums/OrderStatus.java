package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum OrderStatus {

    PENDING("pending", "待生效"),
    ACTIVE("active", "生效中"),
    EXPIRED("expired", "已过期"),
    CANCELLED("cancelled", "已取消");

    private final String value;
    private final String label;
}
