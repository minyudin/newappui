package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum AdoptionCodeStatus {

    ACTIVE("active", "有效"),
    EXPIRED("expired", "已过期"),
    REVOKED("revoked", "已撤销");

    private final String value;
    private final String label;
}
