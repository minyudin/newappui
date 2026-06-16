package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RetireDeviceReq {
    /** 必填：停用原因（审计） */
    @NotBlank(message = "停用原因不能为空")
    private String reason;
}

