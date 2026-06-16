package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "mqtt")
public class MqttProperties {

    private String brokerUrl = "tcp://localhost:1883";
    private String clientId = "longarch-server";
    /**
     * password / tls / mtls. Development keeps password auth; production should
     * use mtls when the gateway supports device certificates.
     */
    private String authMode = "password";
    private String username;
    private String password;
    private String commandTopicPrefix = "longarch/device/command/";
    private String callbackTopic = "longarch/device/callback/#";
    private String callbackTopicPrefix = "longarch/device/callback/";
    private String telemetryTopicPrefix = "longarch/device/telemetry/";
    private String heartbeatTopicPrefix = "longarch/device/heartbeat/";
    /**
     * If no heartbeat is received within this window, mark device offline.
     */
    private long heartbeatOfflineTimeoutSeconds = 120;
    private int qos = 1;
    private int commandQos = 1;
    private int callbackQos = 1;
    private int telemetryQos = 1;
    private int heartbeatQos = 1;
    private long completionTimeout = 30000;
    private int keepAliveInterval = 60;
    private int connectionTimeout = 10;
    private long commandTtlSeconds = 300;
    private int maxPayloadBytes = 64 * 1024;
    private boolean strictDeviceIdentity = false;
    private boolean requireMessageId = false;
    private boolean requireTimestamp = false;
    private long allowedClockSkewSeconds = 300;
    private long replayWindowSeconds = 600;
    private int replayCacheMaxEntries = 10000;
    /**
     * 明文无证书部署开关 · mqtt.allow-insecure
     *  · false (默认) · 生产强制 ssl:// · 安全兜底, 防误把明文 broker 暴露公网
     *  · true         · 允许生产使用明文 tcp:// · 不需要任何 TLS/证书
     *                   仅当 broker 跑在内网/同机 (公网访问不到) 时使用
     *  环境变量: MQTT_ALLOW_INSECURE=true
     */
    private boolean allowInsecure = false;
    private Ssl ssl = new Ssl();

    @Data
    public static class Ssl {
        private boolean enabled = false;
        private String trustStore;
        private String trustStorePassword;
        private String trustStoreType = "PKCS12";
        private String keyStore;
        private String keyStorePassword;
        private String keyStoreType = "PKCS12";
        private String protocol = "TLS";
    }
}
