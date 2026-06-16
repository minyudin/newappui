package com.longarch.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BindMobileReq {

    @NotBlank(message = "手机号不能为空")
    private String mobile;

    @NotBlank(message = "验证码不能为空")
    private String smsCode;
}
