package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum SchedulingMode {

    INSTANT("instant", "即时"),
    QUEUE("queue", "排队"),
    RESERVATION("reservation", "预约");

    private final String value;
    private final String label;
}
