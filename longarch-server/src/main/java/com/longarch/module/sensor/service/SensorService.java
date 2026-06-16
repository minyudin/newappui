package com.longarch.module.sensor.service;

import com.longarch.module.sensor.vo.SensorHistoryVO;
import com.longarch.module.sensor.vo.SensorSummaryVO;
import com.longarch.module.sensor.vo.SensorVO;

import java.util.List;

public interface SensorService {

    List<SensorVO> getSensorList(Long plotId);

    SensorSummaryVO getSensorSummary(Long plotId);

    SensorHistoryVO getSensorHistory(Long sensorId, String startTime, String endTime, String granularity);
}
