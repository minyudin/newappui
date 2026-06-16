package com.longarch.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class ProductionStartupGuardTest {

    @Test
    void prodGuard_shouldRejectDefaultMqttSettings() {
        MqttProperties mqttProperties = new MqttProperties();
        mqttProperties.setUsername("longarch");
        mqttProperties.setPassword("longarch123");
        ProductionStartupGuard guard = configuredGuard(mqttProperties);

        IllegalStateException error = assertThrows(IllegalStateException.class, guard::afterPropertiesSet);
        assertTrue(error.getMessage().contains("mqtt.broker-url"));
        assertTrue(error.getMessage().contains("development defaults"));
    }

    @Test
    void prodGuard_shouldAcceptMqttMtlsSettings() {
        MqttProperties mqttProperties = new MqttProperties();
        mqttProperties.setBrokerUrl("ssl://mqtt.example.com:8883");
        mqttProperties.setClientId("longarch-server-prod");
        mqttProperties.setAuthMode("mtls");
        mqttProperties.setStrictDeviceIdentity(true);
        mqttProperties.setRequireMessageId(true);
        mqttProperties.setRequireTimestamp(true);
        mqttProperties.getSsl().setEnabled(true);
        mqttProperties.getSsl().setKeyStore("file:/etc/longarch/mqtt-client.p12");
        mqttProperties.getSsl().setTrustStore("file:/etc/longarch/mqtt-ca.p12");
        ProductionStartupGuard guard = configuredGuard(mqttProperties);

        assertDoesNotThrow(guard::afterPropertiesSet);
    }

    private ProductionStartupGuard configuredGuard(MqttProperties mqttProperties) {
        ProductionStartupGuard guard = new ProductionStartupGuard(mqttProperties);
        ReflectionTestUtils.setField(guard, "stubMode", false);
        ReflectionTestUtils.setField(guard, "wxAppId", "wx_real_appid");
        ReflectionTestUtils.setField(guard, "wxAppSecret", "real_secret");
        ReflectionTestUtils.setField(guard, "dashboardToken", "dashboard-token");
        ReflectionTestUtils.setField(guard, "adminSeedEnabled", false);
        return guard;
    }
}
