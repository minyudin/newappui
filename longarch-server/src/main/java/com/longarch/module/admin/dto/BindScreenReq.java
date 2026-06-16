package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BindScreenReq {

    private String deviceNo;

    @NotBlank(message = "大屏名称不能为空")
    private String screenName;

    private String layoutConfig;
}
