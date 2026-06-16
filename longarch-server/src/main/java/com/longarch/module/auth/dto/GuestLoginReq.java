package com.longarch.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GuestLoginReq {

    @NotBlank(message = "分享码不能为空")
    private String code;
}
