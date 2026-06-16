package com.longarch.module.dashboard.vo;

import lombok.Data;

import java.util.List;

@Data
public class SensorSeriesVO {

    private Long sensorId;
    private String sensorName;
    private String sensorType;
    private String category;
    private List<SensorHistoryVO.DataPoint> data;
}
