package com.longarch.module.admin.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class PlotSensorOverviewVO {

    private Long plotId;
    private String plotName;

    /** 环境传感器数据：所有环境传感器的最新指标合并到一个 map，如 {"温度":26.5, "湿度":72} */
    private List<SensorGroupInfo> environment;

    /** 土壤传感器数据：每个传感器一个点位 */
    private List<SensorGroupInfo> soil;

    private String updatedAt;

    @Data
    public static class SensorGroupInfo {
        private Long sensorId;
        private String deviceNo;
        private String sensorName;
        private String sensorType;
        private String status;
        private String lastSampleAt;
        /** 该传感器最新的各项指标，如 {"氮":3.1, "磷":1.8, "钾":5.2} */
        private Map<String, Object> metrics;
    }
}
