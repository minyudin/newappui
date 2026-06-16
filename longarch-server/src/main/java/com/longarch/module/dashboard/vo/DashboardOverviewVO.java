package com.longarch.module.dashboard.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class DashboardOverviewVO {

    private List<PlotSummary> plots;
    private DeviceStats deviceStats;
    private List<RecentEvent> recentEvents;

    @Data
    public static class PlotSummary {
        private Long plotId;
        private String plotNo;
        private String plotName;
        private BigDecimal longitude;
        private BigDecimal latitude;
        private EnvData envData;
        private SoilData soilData;
        private int sensorOnline;
        private int sensorTotal;
        private int actuatorOnline;
        private int actuatorTotal;
        private int cameraOnline;
        private int cameraTotal;
    }

    @Data
    public static class EnvData {
        private BigDecimal temperature;
        private BigDecimal humidity;
        private BigDecimal light;
        private BigDecimal co2;
    }

    @Data
    public static class SoilData {
        private BigDecimal nitrogen;
        private BigDecimal phosphorus;
        private BigDecimal potassium;
        private BigDecimal ph;
        private BigDecimal soilTemperature;
        private BigDecimal soilMoisture;
    }

    @Data
    public static class DeviceStats {
        private int sensorTotal;
        private int sensorOnline;
        private int cameraTotal;
        private int cameraOnline;
        private int actuatorTotal;
        private int actuatorOnline;
    }

    @Data
    public static class RecentEvent {
        private String type;
        private String title;
        private String status;
        private String time;
    }
}
