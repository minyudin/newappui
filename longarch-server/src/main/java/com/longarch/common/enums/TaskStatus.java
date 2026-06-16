package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum TaskStatus {

    PENDING("pending", "待处理"),
    QUEUED("queued", "已排队"),
    RUNNING("running", "执行中"),
    SUCCESS("success", "已完成"),
    FAILED("failed", "已失败"),
    CANCELLED("cancelled", "已取消");

    private final String value;
    private final String label;

    public boolean isCancelable() {
        return this == PENDING || this == QUEUED;
    }

    public boolean isTerminal() {
        return this == SUCCESS || this == FAILED || this == CANCELLED;
    }
}
