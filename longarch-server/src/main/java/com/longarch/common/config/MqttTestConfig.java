package com.longarch.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

/**
 * Test profile MQTT stub.
 *
 * Avoids connecting to a real broker during unit/integration tests while keeping
 * the same channel names so {@code MqttGateway} and dispatch flow can run.
 */
@Slf4j
@Configuration
@Profile("test")
public class MqttTestConfig {

    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutboundHandler() {
        return new MessageHandler() {
            @Override
            public void handleMessage(Message<?> message) {
                // No-op: we only need the dispatch pipeline to proceed in tests.
                log.debug("Test MQTT outbound stub received message headers={}, payload={}",
                        message.getHeaders(), message.getPayload());
            }
        };
    }

    @Bean
    public MessageChannel mqttInboundChannel() {
        return new DirectChannel();
    }
}

