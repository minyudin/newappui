package com.longarch.module.admin.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class HardwareAccessInfoVO {

    private String brokerUrl;
    private String authMode;
    private Boolean tlsEnabled;
    private Boolean strictDeviceIdentity;
    private Boolean requireMessageId;
    private Boolean requireTimestamp;
    private Long replayWindowSeconds;
    private Long commandTtlSeconds;
    private Map<String, String> topicPrefixes;
    private Map<String, Integer> qos;
    private List<DeviceAccessInfo> devices;

    @Data
    public static class DeviceAccessInfo {
        private String deviceType;
        private String deviceNo;
        private String clientId;
        private String publishTopic;
        private String subscribeTopic;
        private String status;
        private String lastHeartbeatAt;
        private Long heartbeatAgeSeconds;
        private String lastError;
    }
}
