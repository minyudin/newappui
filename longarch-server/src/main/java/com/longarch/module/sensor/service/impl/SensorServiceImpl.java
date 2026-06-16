package com.longarch.module.sensor.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.sensor.service.SensorService;
import com.longarch.module.sensor.vo.SensorHistoryVO;
import com.longarch.module.sensor.vo.SensorSummaryVO;
import com.longarch.module.sensor.vo.SensorVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensorServiceImpl implements SensorService {

    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final AccessScopeService accessScopeService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public List<SensorVO> getSensorList(Long plotId) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_sensor");
        List<SensorDevice> devices = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plotId));

        return devices.stream().map(d -> {
            SensorVO vo = new SensorVO();
            vo.setSensorId(d.getId());
            vo.setDeviceNo(d.getDeviceNo());
            vo.setSensorType(d.getSensorType());
            vo.setSensorName(d.getSensorName());
            vo.setUnit(d.getUnit());
            vo.setStatus(d.getStatus());
            vo.setLastValue(d.getLastValue());
            vo.setLastSampleAt(d.getLastSampleAt() != null ? d.getLastSampleAt().format(FMT) : null);
            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    public SensorSummaryVO getSensorSummary(Long plotId) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_sensor");
        List<SensorDevice> devices = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plotId));

        SensorSummaryVO vo = new SensorSummaryVO();
        vo.setPlotId(plotId);

        List<SensorSummaryVO.SummaryItem> items = devices.stream().map(d -> {
            SensorSummaryVO.SummaryItem item = new SensorSummaryVO.SummaryItem();
            item.setSensorType(d.getSensorType());
            item.setLabel(d.getSensorName());
            item.setValue(d.getLastValue());
            item.setUnit(d.getUnit());
            item.setSampleAt(d.getLastSampleAt() != null ? d.getLastSampleAt().format(FMT) : null);
            return item;
        }).collect(Collectors.toList());

        vo.setSummary(items);
        return vo;
    }

    @Override
    public SensorHistoryVO getSensorHistory(Long sensorId, String startTime, String endTime, String granularity) {
        SensorDevice device = sensorDeviceMapper.selectById(sensorId);
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "传感器不存在");
        }
        accessScopeService.checkFeatureAccess(device.getPlotId(), "can_view_sensor");

        String normalizedGranularity = normalizeGranularity(granularity);
        LocalDateTime start = LocalDateTime.parse(startTime, FMT);
        LocalDateTime end = LocalDateTime.parse(endTime, FMT);

        List<SensorData> dataList = sensorDataMapper.selectList(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getSensorId, sensorId)
                        .ge(SensorData::getSampleAt, start)
                        .le(SensorData::getSampleAt, end)
                        .orderByAsc(SensorData::getSampleAt));

        SensorHistoryVO vo = new SensorHistoryVO();
        vo.setSensorId(sensorId);
        vo.setSensorType(device != null ? device.getSensorType() : null);

        List<SensorHistoryVO.Series> series = aggregateSeriesByGranularity(dataList, normalizedGranularity);
        vo.setSeries(series);
        // 兼容旧端: 沿用 points 字段，默认回第一条指标序列
        List<SensorHistoryVO.Point> points = series.isEmpty() ? List.of() : series.get(0).getPoints();
        vo.setPoints(points);
        return vo;
    }

    /**
     * 按粒度聚合历史点，保证前端 24H/7D/30D 切换有明确口径:
     * - 10m: 10 分钟桶
     * - 1h : 1 小时桶
     * - 1d : 1 天桶
     *
     * 聚合值使用桶内平均值，时间戳用桶开始时间，方便前端稳定绘图。
     */
    private List<SensorHistoryVO.Series> aggregateSeriesByGranularity(List<SensorData> dataList, String granularity) {
        if (dataList == null || dataList.isEmpty()) {
            return List.of();
        }
        // metricKey -> (bucketStart -> agg)
        Map<String, Map<LocalDateTime, BucketAgg>> metricBuckets = new LinkedHashMap<>();
        for (SensorData d : dataList) {
            if (d.getSampleAt() == null || d.getValue() == null || d.getSensorType() == null || d.getSensorType().isBlank()) {
                continue;
            }
            String metricKey = d.getSensorType().trim();
            LocalDateTime bucketStart = floorToBucket(d.getSampleAt(), granularity);
            Map<LocalDateTime, BucketAgg> bucketMap = metricBuckets.computeIfAbsent(metricKey, k -> new LinkedHashMap<>());
            BucketAgg agg = bucketMap.computeIfAbsent(bucketStart, k -> new BucketAgg());
            agg.sum = agg.sum.add(d.getValue());
            agg.count++;
        }

        List<SensorHistoryVO.Series> seriesList = new ArrayList<>();
        for (Map.Entry<String, Map<LocalDateTime, BucketAgg>> metricEntry : metricBuckets.entrySet()) {
            List<SensorHistoryVO.Point> points = metricEntry.getValue().entrySet().stream().map(e -> {
                SensorHistoryVO.Point p = new SensorHistoryVO.Point();
                p.setSampleAt(e.getKey().format(FMT));
                BucketAgg agg = e.getValue();
                if (agg.count > 0) {
                    p.setValue(agg.sum.divide(BigDecimal.valueOf(agg.count), 4, RoundingMode.HALF_UP));
                }
                return p;
            }).collect(Collectors.toList());

            if (points.isEmpty()) {
                continue;
            }
            SensorHistoryVO.Series s = new SensorHistoryVO.Series();
            s.setMetricKey(metricEntry.getKey());
            s.setPoints(points);
            seriesList.add(s);
        }
        return seriesList;
    }

    private String normalizeGranularity(String granularity) {
        if ("10m".equals(granularity) || "1h".equals(granularity) || "1d".equals(granularity)) {
            return granularity;
        }
        return "1h";
    }

    private LocalDateTime floorToBucket(LocalDateTime t, String granularity) {
        if ("1d".equals(granularity)) {
            return t.withHour(0).withMinute(0).withSecond(0).withNano(0);
        }
        if ("1h".equals(granularity)) {
            return t.withMinute(0).withSecond(0).withNano(0);
        }
        // 10m
        int flooredMinute = (t.getMinute() / 10) * 10;
        return t.withMinute(flooredMinute).withSecond(0).withNano(0);
    }

    private static class BucketAgg {
        private BigDecimal sum = BigDecimal.ZERO;
        private int count = 0;
    }
}
