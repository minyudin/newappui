package com.longarch.module.task.mqtt;

import lombok.Data;

import java.util.Map;

/**
 * 边缘设备通过 MQTT 回报的执行结果
 * Topic: longarch/device/callback/{deviceNo}
 */
@Data
public class DeviceCallbackPayload {

    private Long taskId;
    private String taskNo;
    private Long deviceId;
    private String deviceNo;

    /**
     * success / failed / timeout / network_pending_confirmation
     */
    private String status;

    private String failReason;
    private Map<String, Object> resultData;

    /**
     * 设备侧消息唯一 ID（推荐：UUID/雪花/单调递增序列）
     * 用于回调去重与乱序保护
     */
    private String msgId;

    /**
     * 可选：设备侧递增序列号，用于乱序保护（若有）
     */
    private Long seq;

    private long timestamp;
}
