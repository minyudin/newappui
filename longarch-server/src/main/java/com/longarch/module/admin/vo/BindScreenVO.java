package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class BindScreenVO {
    private Long plotId;
    private Long screenId;
    private String deviceNo;
    private String screenName;
    private String screenToken;
    private boolean bindSuccess;
    private String boundAt;
}
