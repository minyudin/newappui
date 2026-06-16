package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BindSensorReq {

    private String deviceNo;

    @NotBlank(message = "传感器名称不能为空")
    private String sensorName;

    @NotBlank(message = "传感器类型不能为空")
    private String sensorType;

    @NotBlank(message = "传感器分类不能为空(environment/soil)")
    private String category;

    private String unit;
}
