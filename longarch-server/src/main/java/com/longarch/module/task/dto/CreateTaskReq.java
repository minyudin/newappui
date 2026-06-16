package com.longarch.module.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class CreateTaskReq {

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotBlank(message = "操作类型不能为空")
    private String actionType;

    private Map<String, Object> actionParams;

    @NotBlank(message = "调度模式不能为空")
    private String schedulingMode;

    private String expectedExecuteAt;

    @NotBlank(message = "幂等键不能为空")
    private String idempotencyKey;

    /**
     * 任务分发模式:
     * - auto: 默认流程（按现有风控判定是否进入 operator）
     * - direct_operator: 认养者主动直派 operator 处理
     */
    private String dispatchMode;

    /**
     * 当 dispatchMode=direct_operator 时，认养者附加说明（可选）
     */
    private String directOperatorReason;
}
