package com.longarch.module.screen.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ScreenOverviewVO {

    /** 大棚名称（parent plot 的 plotName） */
    private String greenhouseName;
    /** 农场名 */
    private String farmName;

    /** 环境点位的摄像头 */
    private CameraInfo camera;
    /** 环境点位的传感器数据 {temperature:26.5, humidity:72.3, ...} */
    private Map<String, Object> environment;
    /** 所有子点位（土壤点位）列表 */
    private List<PlotPointInfo> plots;
    /** 数据更新时间 */
    private String updatedAt;

    @Data
    public static class CameraInfo {
        private Long cameraId;
        private String cameraName;
        private String flvUrl;
        private String hlsUrl;
        private String status;
    }

    @Data
    public static class PlotPointInfo {
        private Long plotId;
        private String plotName;
        /** 该点位所有传感器最新值 {N:3.1, P:1.8, K:5.2, pH:6.8, soilTemp:22.5, soilMoisture:65.3} */
        private Map<String, Object> sensors;
        private String lastSampleAt;
    }
}
