package com.longarch.module.camera.vo;

import lombok.Data;

@Data
public class LiveUrlVO {

    private Long cameraId;
    /** 推流协议（rtmp） */
    private String protocol;
    /** HTTP-FLV 直播地址（低延迟，前端用 flv.js 播放） */
    private String flvUrl;
    /** HLS 直播地址（兼容性好，延迟较高） */
    private String hlsUrl;
    private String expireAt;
    private String networkStatus;
    private DegradeStrategy degradeStrategy;

    @Data
    public static class DegradeStrategy {
        private Boolean supportsLowBitrate;
        private Boolean supportsSnapshotFallback;
    }
}
