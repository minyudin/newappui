package com.longarch.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.Resource;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;
import java.io.InputStream;
import java.security.KeyStore;

@Slf4j
@Configuration
@Profile("!test")
@RequiredArgsConstructor
public class MqttConfig {

    private final MqttProperties mqttProperties;

    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[]{mqttProperties.getBrokerUrl()});
        if (mqttProperties.getUsername() != null && !mqttProperties.getUsername().isBlank()) {
            options.setUserName(mqttProperties.getUsername());
        }
        if (mqttProperties.getPassword() != null && !mqttProperties.getPassword().isBlank()) {
            options.setPassword(mqttProperties.getPassword().toCharArray());
        }
        options.setKeepAliveInterval(mqttProperties.getKeepAliveInterval());
        options.setConnectionTimeout(mqttProperties.getConnectionTimeout());
        options.setAutomaticReconnect(true);
        options.setCleanSession(false);
        if (mqttProperties.getSsl() != null
                && (mqttProperties.getSsl().isEnabled() || mqttProperties.getBrokerUrl().startsWith("ssl://"))) {
            options.setSocketFactory(buildSslSocketFactory(mqttProperties.getSsl()));
        }
        factory.setConnectionOptions(options);
        return factory;
    }

    // ===== 出站（发送指令到设备） =====

    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutboundHandler(MqttPahoClientFactory factory) {
        String clientId = mqttProperties.getClientId() + "-pub";
        MqttPahoMessageHandler handler = new MqttPahoMessageHandler(clientId, factory);
        handler.setAsync(true);
        handler.setDefaultQos(mqttProperties.getCommandQos());
        handler.setCompletionTimeout(mqttProperties.getCompletionTimeout());
        return handler;
    }

    // ===== 入站（订阅设备回调） =====

    @Bean
    public MessageChannel mqttInboundChannel() {
        return new DirectChannel();
    }

    @Bean
    public MqttPahoMessageDrivenChannelAdapter mqttInboundAdapter(MqttPahoClientFactory factory) {
        String clientId = mqttProperties.getClientId() + "-sub";
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter(
                clientId, factory,
                mqttProperties.getCallbackTopic(),
                mqttProperties.getTelemetryTopicPrefix() + "#",
                mqttProperties.getHeartbeatTopicPrefix() + "#");
        adapter.setCompletionTimeout(mqttProperties.getCompletionTimeout());
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(
                mqttProperties.getCallbackQos(),
                mqttProperties.getTelemetryQos(),
                mqttProperties.getHeartbeatQos());
        adapter.setOutputChannel(mqttInboundChannel());
        return adapter;
    }

    private SSLSocketFactory buildSslSocketFactory(MqttProperties.Ssl ssl) {
        try {
            KeyManagerFactory keyManagerFactory = null;
            if (!isBlank(ssl.getKeyStore())) {
                KeyStore keyStore = loadStore(ssl.getKeyStore(), ssl.getKeyStoreType(), ssl.getKeyStorePassword());
                keyManagerFactory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
                keyManagerFactory.init(keyStore, passwordChars(ssl.getKeyStorePassword()));
            }

            TrustManagerFactory trustManagerFactory = null;
            if (!isBlank(ssl.getTrustStore())) {
                KeyStore trustStore = loadStore(ssl.getTrustStore(), ssl.getTrustStoreType(), ssl.getTrustStorePassword());
                trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                trustManagerFactory.init(trustStore);
            }

            SSLContext sslContext = SSLContext.getInstance(isBlank(ssl.getProtocol()) ? "TLS" : ssl.getProtocol());
            sslContext.init(
                    keyManagerFactory != null ? keyManagerFactory.getKeyManagers() : null,
                    trustManagerFactory != null ? trustManagerFactory.getTrustManagers() : null,
                    null);
            return sslContext.getSocketFactory();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize MQTT SSL context", e);
        }
    }

    private KeyStore loadStore(String location, String type, String password) throws Exception {
        KeyStore store = KeyStore.getInstance(isBlank(type) ? "PKCS12" : type);
        Resource resource = new DefaultResourceLoader().getResource(location);
        try (InputStream input = resource.getInputStream()) {
            store.load(input, passwordChars(password));
        }
        return store;
    }

    private char[] passwordChars(String password) {
        return password != null ? password.toCharArray() : new char[0];
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
