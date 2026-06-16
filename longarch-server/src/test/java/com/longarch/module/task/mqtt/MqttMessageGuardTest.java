package com.longarch.module.task.mqtt;

import com.longarch.common.config.MqttProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MqttMessageGuardTest {

    @Test
    void topicIdentityMismatch_shouldReject() {
        MqttMessageGuard guard = new MqttMessageGuard(new MqttProperties());

        assertFalse(guard.topicIdentityMatches("telemetry", "SEN-001", "SEN-002"));
    }

    @Test
    void duplicateMsgId_shouldRejectReplay() {
        MqttProperties properties = secureProperties();
        MqttMessageGuard guard = new MqttMessageGuard(properties);
        long now = System.currentTimeMillis();

        assertTrue(guard.acceptEnvelope("callback", "ACT-001", "msg-1", null, now));
        assertFalse(guard.acceptEnvelope("callback", "ACT-001", "msg-1", null, now));
    }

    @Test
    void staleTimestamp_shouldRejectWhenTimestampRequired() {
        MqttProperties properties = secureProperties();
        MqttMessageGuard guard = new MqttMessageGuard(properties);
        long stale = System.currentTimeMillis() - 30 * 60 * 1000L;

        assertFalse(guard.acceptEnvelope("heartbeat", "EDGE-001", "hb-1", null, stale));
    }

    @Test
    void developmentMode_shouldAllowLegacyEnvelopeWithoutMsgId() {
        MqttMessageGuard guard = new MqttMessageGuard(new MqttProperties());

        assertTrue(guard.acceptEnvelope("telemetry", "SEN-001", null, null, null));
    }

    private MqttProperties secureProperties() {
        MqttProperties properties = new MqttProperties();
        properties.setStrictDeviceIdentity(true);
        properties.setRequireMessageId(true);
        properties.setRequireTimestamp(true);
        properties.setReplayWindowSeconds(600);
        properties.setAllowedClockSkewSeconds(300);
        return properties;
    }
}
