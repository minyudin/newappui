package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * AI 安全守卫参数（生产模式可配置）
 */
@Data
@Component
@ConfigurationProperties(prefix = "ai.safety")
public class AiSafetyProperties {

    /**
     * 土壤湿度高风险拦截阈值（> block 即硬拦截浇水）
     */
    private double soilMoistureBlockHigh = 70D;

    /**
     * 土壤湿度提醒阈值（> warn 且 <= block 时告警但可确认）
     */
    private double soilMoistureWarnHigh = 60D;

    /**
     * 土壤湿度建议浇水阈值（< suggestDry 时提示偏干）
     */
    private double soilMoistureSuggestDry = 45D;

    /**
     * 传感器数据过期阈值（分钟）
     */
    private long dataStaleThresholdMinutes = 120;

    /**
     * 施肥最小间隔（小时）
     */
    private int minFertilizeIntervalHours = 48;

    /**
     * 同类型操作最小间隔（分钟）
     */
    private int minSameActionIntervalMinutes = 30;
}

