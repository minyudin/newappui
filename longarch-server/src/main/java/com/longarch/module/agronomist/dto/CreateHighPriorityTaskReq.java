package com.longarch.module.agronomist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateHighPriorityTaskReq {

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotBlank(message = "操作类型不能为空")
    private String actionType;

    private String actionParams;

    private String reason;

    private Integer priority;
}
