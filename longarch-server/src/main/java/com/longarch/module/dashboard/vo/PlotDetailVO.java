package com.longarch.module.dashboard.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PlotDetailVO {

    private Long plotId;
    private String plotName;

    private EnvData envData;
    private SoilData soilData;
    private List<SensorGroupVO> sensorGroups;
    private CameraInfo camera;
    private List<ActuatorInfo> actuators;
    private List<TaskRecord> recentTasks;

    @Data
    public static class EnvData {
        private BigDecimal temperature;
        private BigDecimal humidity;
        private BigDecimal light;
        private BigDecimal co2;
        private String updatedAt;
    }

    @Data
    public static class SoilData {
        private BigDecimal nitrogen;
        private BigDecimal phosphorus;
        private BigDecimal potassium;
        private BigDecimal ph;
        private BigDecimal soilTemperature;
        private BigDecimal soilMoisture;
        private String updatedAt;
    }

    @Data
    public static class CameraInfo {
        private Long id;
        private String deviceNo;
        private String cameraName;
        private String networkStatus;
        private String streamUrl;
    }

    @Data
    public static class ActuatorInfo {
        private Long id;
        private String deviceNo;
        private String deviceName;
        private String deviceType;
        private String deviceStatus;
        private String networkStatus;
    }

    @Data
    public static class TaskRecord {
        private Long id;
        private String taskNo;
        private String actionType;
        private String taskStatus;
        private String deviceName;
        private String createdAt;
    }
}
