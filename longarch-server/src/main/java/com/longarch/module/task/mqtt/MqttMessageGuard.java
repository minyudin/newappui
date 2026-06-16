package com.longarch.module.task.mqtt;

import com.longarch.common.config.MqttProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttMessageGuard {

    private final MqttProperties mqttProperties;
    private final ConcurrentMap<String, Long> replayCache = new ConcurrentHashMap<>();

    public boolean acceptPayloadSize(String topic, String payload) {
        int maxBytes = Math.max(1024, mqttProperties.getMaxPayloadBytes());
        int bytes = payload != null ? payload.getBytes(StandardCharsets.UTF_8).length : 0;
        if (bytes > maxBytes) {
            log.warn("MQTT payload rejected because it is too large: topic={}, bytes={}, maxBytes={}",
                    topic, bytes, maxBytes);
            return false;
        }
        return true;
    }

    public boolean topicIdentityMatches(String channel, String topicIdentity, String payloadIdentity) {
        return topicIdentityMatches(channel, topicIdentity, payloadIdentity, false);
    }

    public boolean topicIdentityMatches(String channel, String topicIdentity, String payloadIdentity, boolean requirePayloadIdentity) {
        if (isBlank(topicIdentity)) {
            log.warn("MQTT {} rejected because topic identity is blank", channel);
            return false;
        }
        if (isBlank(payloadIdentity)) {
            if (requirePayloadIdentity || mqttProperties.isStrictDeviceIdentity()) {
                log.warn("MQTT {} rejected because payload identity is blank: topicIdentity={}",
                        channel, topicIdentity);
                return false;
            }
            return true;
        }
        if (!topicIdentity.equals(payloadIdentity)) {
            log.warn("MQTT {} rejected because payload identity does not match topic: topicIdentity={}, payloadIdentity={}",
                    channel, topicIdentity, payloadIdentity);
            return false;
        }
        return true;
    }

    public boolean acceptEnvelope(String channel, String identity, String msgId, Long seq, Long timestamp) {
        if (isBlank(identity)) {
            log.warn("MQTT {} rejected because envelope identity is blank", channel);
            return false;
        }

        if (mqttProperties.isRequireTimestamp()) {
            if (timestamp == null || timestamp <= 0) {
                log.warn("MQTT {} rejected because timestamp is required: identity={}", channel, identity);
                return false;
            }
            if (!timestampWithinWindow(timestamp)) {
                log.warn("MQTT {} rejected because timestamp is outside replay window: identity={}, timestamp={}",
                        channel, identity, timestamp);
                return false;
            }
        }

        boolean hasReplayKey = !isBlank(msgId) || seq != null;
        if (mqttProperties.isRequireMessageId() && !hasReplayKey) {
            log.warn("MQTT {} rejected because msgId or seq is required: identity={}", channel, identity);
            return false;
        }
        if (!hasReplayKey) {
            return true;
        }

        cleanupReplayCacheIfNeeded();
        long now = System.currentTimeMillis();
        long ttlMillis = Math.max(30, mqttProperties.getReplayWindowSeconds()) * 1000L;
        long expiresAt = now + ttlMillis;
        String key = channel + ":" + identity + ":" + (!isBlank(msgId) ? "msg:" + msgId.trim() : "seq:" + seq);
        Long previousExpiresAt = replayCache.putIfAbsent(key, expiresAt);
        if (previousExpiresAt != null && previousExpiresAt > now) {
            log.warn("MQTT {} rejected as replay: identity={}, replayKey={}", channel, identity, key);
            return false;
        }
        if (previousExpiresAt != null) {
            replayCache.put(key, expiresAt);
        }
        return true;
    }

    public String topicSuffix(String topic, String prefix) {
        if (topic == null || prefix == null || !topic.startsWith(prefix)) {
            return null;
        }
        String suffix = topic.substring(prefix.length());
        if (suffix.contains("/")) {
            suffix = suffix.substring(suffix.lastIndexOf('/') + 1);
        }
        return suffix.isBlank() ? null : suffix;
    }

    public String stringField(Map<String, Object> data, String... keys) {
        if (data == null) {
            return null;
        }
        for (String key : keys) {
            Object value = data.get(key);
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return null;
    }

    public Long longField(Map<String, Object> data, String... keys) {
        String value = stringField(data, keys);
        if (isBlank(value)) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean timestampWithinWindow(long rawTimestamp) {
        long timestampMs = rawTimestamp < 1_000_000_000_000L ? rawTimestamp * 1000L : rawTimestamp;
        long now = System.currentTimeMillis();
        long replayWindowMs = Math.max(30, mqttProperties.getReplayWindowSeconds()) * 1000L;
        long futureSkewMs = Math.max(0, mqttProperties.getAllowedClockSkewSeconds()) * 1000L;
        return timestampMs >= now - replayWindowMs && timestampMs <= now + futureSkewMs;
    }

    private void cleanupReplayCacheIfNeeded() {
        int maxEntries = Math.max(100, mqttProperties.getReplayCacheMaxEntries());
        if (replayCache.size() <= maxEntries) {
            return;
        }
        long now = System.currentTimeMillis();
        replayCache.entrySet().removeIf(entry -> entry.getValue() <= now);
        if (replayCache.size() > maxEntries) {
            log.warn("MQTT replay cache exceeded max entries after cleanup, clearing cache: size={}, max={}",
                    replayCache.size(), maxEntries);
            replayCache.clear();
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
