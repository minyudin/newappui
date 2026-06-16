package com.longarch.module.edge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ExecutionCallbackReq {

    @NotNull(message = "任务ID不能为空")
    private Long taskId;

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotBlank(message = "执行状态不能为空")
    private String executionState;

    private String startedAt;
    private String finishedAt;
    private String remark;
}
