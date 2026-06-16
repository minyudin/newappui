package com.longarch.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WechatLoginReq {

    @NotBlank(message = "微信登录code不能为空")
    private String code;

    private String inviteCode;
}
