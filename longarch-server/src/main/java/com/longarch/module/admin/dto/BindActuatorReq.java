package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BindActuatorReq {

    private String deviceNo;

    @NotBlank(message = "设备名称不能为空")
    private String deviceName;

    @NotBlank(message = "设备类型不能为空")
    private String deviceType;

    private String edgeNodeNo;

    /**
     * 更换设备：当同地块同类设备已存在时（如 irrigator），必须显式指定要替换的旧设备 ID。
     * 后端会先停用旧设备（软删除 + 审计），再绑定新设备。
     */
    private Long replaceDeviceId;

    /** 更换原因（审计） */
    private String replaceReason;
}
