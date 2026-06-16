package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 流媒体服务器配置（SRS / ZLMediaKit）
 *
 * 协议链路：
 *   摄像头/边缘网关 ──RTMP推流──▶ SRS ──┬── HTTP-FLV ──▶ 浏览器(低延迟)
 *                                        ├── HLS ──────▶ 浏览器(兼容)
 *                                        └── DVR录像 ──▶ 回放
 */
@Data
@Component
@ConfigurationProperties(prefix = "media-server")
public class MediaServerProperties {

    /** SRS HTTP API 地址（管理接口：查流/踢流/截图） */
    private String apiBase = "http://localhost:1985";

    /** RTMP 推流基地址（摄像头/边缘推流目标） */
    private String rtmpBase = "rtmp://localhost:1935";

    /** HTTP-FLV 播放基地址（前端直播用，低延迟） */
    private String httpFlvBase = "http://localhost:8080";

    /** HLS 播放基地址（前端直播/回放用，兼容性好） */
    private String hlsBase = "http://localhost:8080";

    /** 默认直播流应用名 */
    private String liveApp = "live";

    /** DVR 录像回放应用名 */
    private String playbackApp = "playback";
}
