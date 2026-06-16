package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class ScreenListVO {
    private Long screenId;
    private String deviceNo;
    private String screenName;
    private Long plotId;
    private String plotName;
    private String screenToken;
    private String status;
    private String lastPingAt;
    private String createdAt;
}
