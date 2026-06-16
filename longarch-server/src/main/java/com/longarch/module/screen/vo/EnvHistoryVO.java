package com.longarch.module.screen.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 环境传感器历史数据 — 供大屏 sparkline 使用
 * <p>
 * key = sensorType（temperature / humidity / light / CO2）
 * value = 最近 N 条采样记录（按时间升序）
 */
@Data
public class EnvHistoryVO {

    /** key = sensorType, value = 该类型的历史点列表 */
    private Map<String, List<DataPoint>> series;

    @Data
    public static class DataPoint {
        private BigDecimal value;
        private String sampleAt;
    }
}
