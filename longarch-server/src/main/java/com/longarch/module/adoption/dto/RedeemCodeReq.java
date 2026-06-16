package com.longarch.module.adoption.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RedeemCodeReq {

    @NotBlank(message = "认养码不能为空")
    private String code;
}
