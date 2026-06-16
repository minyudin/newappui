package com.longarch.module.sensor.mapper;

import com.longarch.BaseTest;
import com.longarch.module.sensor.entity.SensorData;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证批量“取每个 (sensor_id, sensor_type) 最新读数”查询（替代 N+1）。
 */
class SensorDataMapperTest extends BaseTest {

    @Autowired
    private SensorDataMapper sensorDataMapper;

    private SensorData row(long sensorId, long plotId, String type, double value, LocalDateTime at) {
        SensorData d = new SensorData();
        d.setSensorId(sensorId);
        d.setPlotId(plotId);
        d.setSensorType(type);
        d.setValue(BigDecimal.valueOf(value));
        d.setSampleAt(at);
        return d;
    }

    @Test
    void selectLatestPerType_returnsLatestRowForEachSensorAndType() {
        long s1 = 90001L;
        long s2 = 90002L;
        long plot = 91001L;
        LocalDateTime base = LocalDateTime.of(2026, 1, 1, 0, 0);

        // sensor1: 两种指标，各两条，较新的应胜出
        sensorDataMapper.insert(row(s1, plot, "temperature", 20.0, base));
        sensorDataMapper.insert(row(s1, plot, "temperature", 25.5, base.plusHours(1)));
        sensorDataMapper.insert(row(s1, plot, "humidity", 60.0, base));
        sensorDataMapper.insert(row(s1, plot, "humidity", 65.0, base.plusHours(2)));
        // sensor2: 单指标
        sensorDataMapper.insert(row(s2, plot, "soil_moisture", 40.0, base));
        sensorDataMapper.insert(row(s2, plot, "soil_moisture", 42.0, base.plusHours(3)));

        List<SensorData> latest = sensorDataMapper.selectLatestPerType(List.of(s1, s2));

        // 期望 3 条：s1/temperature、s1/humidity、s2/soil_moisture
        assertEquals(3, latest.size(), "每个 (sensor,type) 只应返回一条最新读数");

        Map<String, SensorData> byKey = latest.stream()
                .collect(Collectors.toMap(d -> d.getSensorId() + ":" + d.getSensorType(), d -> d));

        assertEquals(0, byKey.get(s1 + ":temperature").getValue().compareTo(BigDecimal.valueOf(25.5)));
        assertEquals(0, byKey.get(s1 + ":humidity").getValue().compareTo(BigDecimal.valueOf(65.0)));
        assertEquals(0, byKey.get(s2 + ":soil_moisture").getValue().compareTo(BigDecimal.valueOf(42.0)));
    }

    @Test
    void selectLatestPerType_emptyInputHandledByCaller() {
        // 调用方在传感器为空时不会调用本方法；此处仅验证单 id 行为
        List<SensorData> latest = sensorDataMapper.selectLatestPerType(List.of(99999L));
        assertTrue(latest.isEmpty());
    }
}
