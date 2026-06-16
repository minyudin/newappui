package com.longarch.module.task.vo;

import lombok.Data;

import java.util.List;

@Data
public class AllowedActionsVO {

    private Long plotId;
    private List<ActionItem> actions;

    /** 今日允许的最大操作次数 (来自 adoption_code.max_daily_operations) */
    private Integer dailyLimit;
    /** 今日已用次数 (按 createdAt >= 今日 0 点 + 状态非 cancelled/failed 计) */
    private Integer dailyUsed;
    /** 今日剩余次数 = max(0, dailyLimit - dailyUsed) · 给前端省心计算 */
    private Integer dailyRemaining;

    @Data
    public static class ActionItem {
        private String actionType;
        private String actionName;
        private Boolean enabled;
        private String reason;

        /** 该动作在当前地块上默认对应的执行设备 (匹配 actionType.requiredDeviceType) */
        private Long deviceId;
        private String deviceName;

        /** 必填参数名 (前端据此建表单) · 例如 ["durationMinutes"] */
        private List<String> requiredParams;
        /** 可选参数名 · 例如 ["waterVolumeLiters", "flowRate"] */
        private List<String> optionalParams;
    }
}
