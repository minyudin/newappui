package com.longarch.module.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ZhipuClient {

    @Value("${zhipu.api-key:}")
    private String apiKey;

    @Value("${zhipu.model:glm-4-flash}")
    private String model;

    @Value("${zhipu.base-url:https://open.bigmodel.cn/api/paas/v4}")
    private String baseUrl;

    private static final int MAX_RETRIES = 2;
    private static final int MAX_USER_MESSAGE_LENGTH = 2000;
    private static final int MAX_RESPONSE_LENGTH = 5000;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ZhipuClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(30000);
        this.restTemplate = new RestTemplate(factory);
    }

    public String chat(String systemPrompt, String userMessage) {
        // 输入防护：截断过长消息，防止prompt注入的简单策略
        String sanitized = sanitizeInput(userMessage);

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                String result = doCall(systemPrompt, sanitized);
                if (result != null && !result.isBlank()) {
                    // 输出防护：截断过长响应
                    if (result.length() > MAX_RESPONSE_LENGTH) {
                        log.warn("Zhipu response too long ({}), truncating", result.length());
                        result = result.substring(0, MAX_RESPONSE_LENGTH) + "...";
                    }
                    return result;
                }
                log.warn("Zhipu API returned empty on attempt {}/{}", attempt, MAX_RETRIES);
            } catch (Exception e) {
                log.error("Zhipu API call failed on attempt {}/{}: {}", attempt, MAX_RETRIES, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    try { Thread.sleep(1000L * attempt); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                }
            }
        }
        log.error("Zhipu API all {} retries exhausted", MAX_RETRIES);
        return null;
    }

    private String doCall(String systemPrompt, String userMessage) throws Exception {
        String url = baseUrl + "/chat/completions";

        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userMessage)
                ),
                "temperature", 0.7,
                "max_tokens", 1024
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        log.info("Zhipu API request: model={}, messageLength={}", model, userMessage.length());
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        String content = root.path("choices").path(0).path("message").path("content").asText();
        log.info("Zhipu API response: length={}", content.length());
        return content;
    }

    /**
     * 输入消毒：
     * 1. 截断过长消息
     * 2. 移除可能的prompt注入标记
     */
    private String sanitizeInput(String input) {
        if (input == null) return "";
        String sanitized = input;
        if (sanitized.length() > MAX_USER_MESSAGE_LENGTH) {
            log.warn("User message too long ({}), truncating to {}", sanitized.length(), MAX_USER_MESSAGE_LENGTH);
            sanitized = sanitized.substring(0, MAX_USER_MESSAGE_LENGTH);
        }
        // 移除常见 prompt 注入标记
        sanitized = sanitized.replaceAll("(?i)(ignore previous|forget your|system prompt|你是一个|你现在是|忽略之前|忽略上面)", "[FILTERED]");
        return sanitized;
    }
}
