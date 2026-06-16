package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Getter
@AllArgsConstructor
public enum ActionType {

    IRRIGATION_APPLY("irrigation_apply", "申请浇水", "irrigator",
            List.of("durationMinutes"),
            List.of("waterVolumeLiters", "flowRate")),

    FERTILIZE_APPLY("fertilize_apply", "申请施肥", "fertilizer",
            List.of("durationMinutes", "fertilizerType"),
            List.of("concentrationPercent", "volumeLiters")),

    SPRAY_APPLY("spray_apply", "申请喷淋", "sprayer",
            List.of("durationMinutes"),
            List.of("sprayType", "pressureBar"));

    private final String value;
    private final String label;
    /** 该动作对应的设备类型 */
    private final String requiredDeviceType;
    /** 必填参数名 */
    private final List<String> requiredParams;
    /** 可选参数名 */
    private final List<String> optionalParams;

    public Set<String> allParamNames() {
        Set<String> all = new java.util.HashSet<>(requiredParams);
        all.addAll(optionalParams);
        return all;
    }

    /**
     * 校验 actionParams 是否合法
     * @return null 表示通过，非 null 表示错误原因
     */
    public String validateParams(Map<String, Object> params) {
        if (params == null) params = Map.of();
        for (String required : requiredParams) {
            if (!params.containsKey(required) || params.get(required) == null) {
                return "缺少必填参数: " + required;
            }
        }
        // durationMinutes 必须是 1~120 的正整数
        if (params.containsKey("durationMinutes")) {
            Object val = params.get("durationMinutes");
            int duration;
            try {
                duration = val instanceof Number ? ((Number) val).intValue() : Integer.parseInt(val.toString());
            } catch (Exception e) {
                return "durationMinutes 必须是正整数";
            }
            if (duration < 1 || duration > 120) {
                return "durationMinutes 必须在 1~120 之间";
            }
        }
        return null;
    }

    public static ActionType fromValue(String value) {
        for (ActionType type : values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        return null;
    }
}
