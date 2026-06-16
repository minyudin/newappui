package com.longarch.module.camera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.common.config.MediaServerProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * 查询 SRS 流媒体服务器的实时推流状态。
 * 调用 SRS HTTP API: GET {apiBase}/api/v1/streams/
 * 返回当前正在推流的 stream key 集合（格式 "app/streamName"）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrsStreamService {

    private final MediaServerProperties mediaServer;
    private final ObjectMapper objectMapper;

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        return new RestTemplate(factory);
    }

    /**
     * 获取 SRS 当前所有活跃推流的 stream key 集合。
     * 每个 key 格式为 "app/streamName"，例如 "live/CAM-DM01"。
     * 如果 SRS 不可达或解析失败，返回空集合（不影响正常业务）。
     */
    public Set<String> getActiveStreamKeys() {
        String url = mediaServer.getApiBase() + "/api/v1/streams/";
        try {
            RestTemplate restTemplate = buildRestTemplate();
            String body = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(body);
            JsonNode streams = root.path("streams");
            if (!streams.isArray()) {
                return Collections.emptySet();
            }
            Set<String> keys = new HashSet<>();
            for (JsonNode stream : streams) {
                String app = stream.path("app").asText("");
                String name = stream.path("name").asText("");
                if (!app.isEmpty() && !name.isEmpty()) {
                    keys.add(app + "/" + name);
                }
            }
            log.debug("SRS active streams: {}", keys);
            return keys;
        } catch (Exception e) {
            log.warn("Failed to query SRS streams from {}: {}", url, e.getMessage());
            return Collections.emptySet();
        }
    }

    /**
     * 判断指定摄像头是否正在推流。
     */
    public boolean isStreaming(String streamApp, String streamName) {
        Set<String> active = getActiveStreamKeys();
        return active.contains(streamApp + "/" + streamName);
    }
}
