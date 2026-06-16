package com.longarch.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Fail fast on production-only configuration mistakes that would otherwise
 * surface as unsafe authentication or public unauthenticated dashboard access.
 */
@Slf4j
@Component
@Profile("prod")
@RequiredArgsConstructor
public class ProductionStartupGuard implements InitializingBean {

    private final MqttProperties mqttProperties;
    private final WechatMiniProperties wechatMiniProperties;

    @Value("${dashboard.token:}")
    private String dashboardToken;

    @Value("${longarch.admin.seed.enabled:false}")
    private boolean adminSeedEnabled;

    @Override
    public void afterPropertiesSet() {
        List<String> errors = new ArrayList<>();
        if (wechatMiniProperties.isStubMode()) {
            errors.add("wechat.miniapp.stub-mode must be false");
        }
        if (!wechatMiniProperties.hasRealCredentials()) {
            errors.add("wechat.miniapp.app-id / app-secret must be real values (not stub placeholders)");
        }
        if (isBlank(dashboardToken)) {
            errors.add("dashboard.token must be configured");
        }
        if (adminSeedEnabled) {
            errors.add("longarch.admin.seed.enabled must be false in prod");
        }
        validateMqtt(errors);

        if (!errors.isEmpty()) {
            throw new IllegalStateException("Production configuration invalid: " + String.join("; ", errors));
        }
        log.info("Production startup guard passed");
    }

    private void validateMqtt(List<String> errors) {
        String brokerUrl = mqttProperties.getBrokerUrl();
        String authMode = mqttProperties.getAuthMode();
        if (isBlank(brokerUrl)) {
            errors.add("mqtt.broker-url must be configured");
        } else {
            String normalized = brokerUrl.toLowerCase();
            if (normalized.contains("localhost") || normalized.contains("127.0.0.1")) {
                errors.add("mqtt.broker-url must not point to localhost in prod");
            }
            if (normalized.startsWith("tcp://")) {
                errors.add("mqtt.broker-url must use ssl:// in prod");
            }
        }

        if (isBlank(mqttProperties.getClientId())) {
            errors.add("mqtt.client-id must be stable and configured");
        }
        if (!mqttProperties.isStrictDeviceIdentity()) {
            errors.add("mqtt.strict-device-identity must be true in prod");
        }
        if (!mqttProperties.isRequireMessageId()) {
            errors.add("mqtt.require-message-id must be true in prod");
        }
        if (!mqttProperties.isRequireTimestamp()) {
            errors.add("mqtt.require-timestamp must be true in prod");
        }

        if (!"mtls".equalsIgnoreCase(authMode)
                && !"password".equalsIgnoreCase(authMode)
                && !"tls".equalsIgnoreCase(authMode)) {
            errors.add("mqtt.auth-mode must be one of password, tls, mtls");
            return;
        }

        if ("mtls".equalsIgnoreCase(authMode)) {
            if (mqttProperties.getSsl() == null || !mqttProperties.getSsl().isEnabled()) {
                errors.add("mqtt.ssl.enabled must be true when mqtt.auth-mode=mtls");
            } else {
                if (isBlank(mqttProperties.getSsl().getKeyStore())) {
                    errors.add("mqtt.ssl.key-store must be configured when mqtt.auth-mode=mtls");
                }
                if (isBlank(mqttProperties.getSsl().getTrustStore())) {
                    errors.add("mqtt.ssl.trust-store must be configured when mqtt.auth-mode=mtls");
                }
            }
            return;
        }

        if ("tls".equalsIgnoreCase(authMode)) {
            if (mqttProperties.getSsl() == null || !mqttProperties.getSsl().isEnabled()) {
                errors.add("mqtt.ssl.enabled must be true when mqtt.auth-mode=tls");
            }
            return;
        }

        if ("password".equalsIgnoreCase(authMode)) {
            if (isBlank(mqttProperties.getUsername())) {
                errors.add("mqtt.username must be configured when mqtt.auth-mode=password");
            }
            if (isBlank(mqttProperties.getPassword())) {
                errors.add("mqtt.password must be configured when mqtt.auth-mode=password");
            }
            if ("longarch".equals(mqttProperties.getUsername())
                    || "longarch123".equals(mqttProperties.getPassword())) {
                errors.add("mqtt username/password must not use development defaults in prod");
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
