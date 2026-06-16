package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum DeviceExecutionState {

    SUBMITTED("submitted", "已提交"),
    QUEUED("queued", "已排队"),
    DISPATCHED("dispatched", "已下发"),
    RUNNING("running", "执行中"),
    SUCCESS("success", "执行成功"),
    FAILED("failed", "执行失败"),
    NETWORK_PENDING_CONFIRMATION("network_pending_confirmation", "网络待确认");

    private final String value;
    private final String label;
}
