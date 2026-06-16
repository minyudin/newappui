package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {

    SUCCESS(0, "success"),
    INVALID_PARAM(40001, "invalid_param"),
    INVALID_TOKEN(40002, "invalid_token"),
    UNAUTHORIZED(40003, "unauthorized"),
    FORBIDDEN(40004, "forbidden"),
    RESOURCE_NOT_FOUND(40005, "resource_not_found"),
    INVALID_STATUS(40006, "invalid_status"),
    DUPLICATE_REQUEST(40007, "duplicate_request"),
    OUT_OF_TIME_WINDOW(40008, "out_of_time_window"),
    ADOPTION_CODE_INVALID(40009, "adoption_code_invalid"),
    ADOPTION_CODE_EXPIRED(40010, "adoption_code_expired"),
    ORDER_EXPIRED(40011, "order_expired"),
    PLOT_ACCESS_DENIED(40012, "plot_access_denied"),
    ACTION_NOT_ALLOWED(40013, "action_not_allowed"),
    ACTUATOR_BUSY(40014, "actuator_busy"),
    QUEUE_CONFLICT(40015, "queue_conflict"),
    TASK_NOT_CANCELABLE(40016, "task_not_cancelable"),
    PLAYBACK_NOT_ALLOWED(40017, "playback_not_allowed"),
    TOO_MANY_REQUESTS(40018, "too_many_requests"),
    NICKNAME_INVALID(40019, "nickname_invalid"),
    NICKNAME_DUPLICATED(40020, "nickname_duplicated"),
    NICKNAME_ALREADY_SET(40021, "nickname_already_set"),
    INTERNAL_ERROR(50000, "internal_error"),
    EDGE_NODE_UNREACHABLE(50001, "edge_node_unreachable"),
    DEVICE_EXECUTE_FAILED(50002, "device_execute_failed"),
    NETWORK_PENDING_CONFIRMATION(50003, "network_pending_confirmation");

    private final int code;
    private final String message;
}
