package com.longarch.module.auth.vo;

import lombok.Data;

@Data
public class WechatLoginVO {

    private String token;
    private String refreshToken;
    private Integer expiresIn;
    private UserInfoVO userInfo;
}
