package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateOrderStatusReq {
    @NotBlank(message = "orderStatus不能为空")
    private String orderStatus;
    private String payStatus;
    private String remark;
}
