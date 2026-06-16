package com.longarch.module.screen.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.config.MediaServerProperties;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.module.camera.entity.CameraDevice;
import com.longarch.module.camera.mapper.CameraDeviceMapper;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.screen.entity.ScreenDevice;
import com.longarch.module.screen.mapper.ScreenDeviceMapper;
import com.longarch.module.screen.service.ScreenService;
import com.longarch.module.screen.vo.EnvHistoryVO;
import com.longarch.module.screen.vo.GreenhouseListVO;
import com.longarch.module.screen.vo.ScreenOverviewVO;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScreenServiceImpl implements ScreenService {

    private final ScreenDeviceMapper screenDeviceMapper;
    private final PlotMapper plotMapper;
    private final CameraDeviceMapper cameraDeviceMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final MediaServerProperties mediaServer;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // ── 公共：认证 + 心跳 ─────────────────────────────────────
    private ScreenDevice authenticate(String screenToken) {
        if (screenToken == null || screenToken.isBlank()) {
            throw new BizException(ErrorCode.UNAUTHORIZED, "缺少大屏认证 token");
        }
        ScreenDevice screen = screenDeviceMapper.selectOne(
                new LambdaQueryWrapper<ScreenDevice>()
                        .eq(ScreenDevice::getScreenToken, screenToken));
        if (screen == null) {
            throw new BizException(ErrorCode.UNAUTHORIZED, "无效的大屏 token");
        }
        screen.setStatus("online");
        screen.setLastPingAt(LocalDateTime.now());
        screenDeviceMapper.updateById(screen);
        return screen;
    }

    /**
     * 解析目标大棚 ID：如果传了 greenhouseId 则校验同农场后使用，否则用 token 绑定的大棚
     *
     *  · 严格化容错: 绑定 plot 已被删除时不再静默返回幽灵 ID, 而是抛 RESOURCE_NOT_FOUND
     *    避免下游"未知大棚 / 未知农场"占位污染数据展示, 也防止 farm 校验被绕过
     *  · 目标 plot 不存在 → 也抛 RESOURCE_NOT_FOUND (客户端传错了大棚 ID)
     */
    private Long resolveGreenhouseId(ScreenDevice screen, Long greenhouseId) {
        Long defaultId = screen.getPlotId();
        Plot defaultGh = plotMapper.selectById(defaultId);
        if (defaultGh == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND,
                    "大屏绑定的大棚已不存在: plotId=" + defaultId);
        }
        if (greenhouseId == null || Objects.equals(greenhouseId, defaultId)) {
            return defaultId;
        }
        // 校验目标大棚和 token 绑定大棚属于同一农场
        Plot targetGh = plotMapper.selectById(greenhouseId);
        if (targetGh == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND,
                    "目标大棚不存在: greenhouseId=" + greenhouseId);
        }
        if (!Objects.equals(defaultGh.getFarmId(), targetGh.getFarmId())) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权查看其他农场的大棚");
        }
        return greenhouseId;
    }

    @Override
    public ScreenOverviewVO getOverview(String screenToken, Long greenhouseId) {
        ScreenDevice screen = authenticate(screenToken);
        Long resolvedId = resolveGreenhouseId(screen, greenhouseId);
        Plot greenhouse = plotMapper.selectById(resolvedId);

        ScreenOverviewVO vo = new ScreenOverviewVO();
        vo.setGreenhouseName(greenhouse != null ? greenhouse.getPlotName() : "未知大棚");
        vo.setFarmName(greenhouse != null ? greenhouse.getFarmName() : "未知农场");

        // 查所有子点位（parent_id = resolvedId）
        List<Plot> childPlots = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>()
                        .eq(Plot::getParentId, resolvedId)
                        .orderByAsc(Plot::getId));

        Map<String, Object> environment = new LinkedHashMap<>();
        List<ScreenOverviewVO.PlotPointInfo> plotPoints = new ArrayList<>();

        for (Plot childPlot : childPlots) {
            List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                    new LambdaQueryWrapper<SensorDevice>()
                            .eq(SensorDevice::getPlotId, childPlot.getId()));

            boolean hasEnvSensor = sensors.stream().anyMatch(this::isEnvironmentSensor);

            if (hasEnvSensor) {
                // 环境点位：填充 camera + environment
                vo.setCamera(buildCameraInfo(childPlot.getId()));
                for (SensorDevice sensor : sensors) {
                    if (isEnvironmentSensor(sensor)) {
                        for (SensorData data : getLatestSensorData(sensor.getId())) {
                            environment.put(data.getSensorType(), data.getValue());
                        }
                    }
                }
            } else {
                // 土壤点位：聚合该点位所有传感器数据到一张卡片
                ScreenOverviewVO.PlotPointInfo point = new ScreenOverviewVO.PlotPointInfo();
                point.setPlotId(childPlot.getId());
                point.setPlotName(childPlot.getPlotName());

                Map<String, Object> sensorMap = new LinkedHashMap<>();
                LocalDateTime latestSample = null;

                for (SensorDevice sensor : sensors) {
                    for (SensorData data : getLatestSensorData(sensor.getId())) {
                        sensorMap.put(data.getSensorType(), data.getValue());
                        if (data.getSampleAt() != null) {
                            if (latestSample == null || data.getSampleAt().isAfter(latestSample)) {
                                latestSample = data.getSampleAt();
                            }
                        }
                    }
                }
                point.setSensors(sensorMap);
                point.setLastSampleAt(latestSample != null ? latestSample.format(FMT) : null);
                plotPoints.add(point);
            }
        }

        vo.setEnvironment(environment);
        vo.setPlots(plotPoints);
        vo.setUpdatedAt(LocalDateTime.now().format(FMT));

        log.debug("Screen overview: greenhouse={}, childPlots={}, screenDeviceNo={}",
                vo.getGreenhouseName(), childPlots.size(), screen.getDeviceNo());
        return vo;
    }

    private ScreenOverviewVO.CameraInfo buildCameraInfo(Long plotId) {
        CameraDevice camera = cameraDeviceMapper.selectOne(
                new LambdaQueryWrapper<CameraDevice>()
                        .eq(CameraDevice::getPlotId, plotId)
                        .last("LIMIT 1"));
        if (camera == null) return null;

        String app = camera.getStreamApp() != null ? camera.getStreamApp() : mediaServer.getLiveApp();
        String stream = camera.getStreamName() != null ? camera.getStreamName() : camera.getDeviceNo();

        ScreenOverviewVO.CameraInfo info = new ScreenOverviewVO.CameraInfo();
        info.setCameraId(camera.getId());
        info.setCameraName(camera.getCameraName());
        info.setFlvUrl(mediaServer.getHttpFlvBase() + "/" + app + "/" + stream + ".flv");
        info.setHlsUrl(mediaServer.getHlsBase() + "/" + app + "/" + stream + ".m3u8");
        info.setStatus(camera.getNetworkStatus());
        return info;
    }

    /**
     * 查传感器最新的各个指标（同一个传感器可能上报多种指标如 钾、氮、pH）
     * 取每种指标最新的一条
     */
    private List<SensorData> getLatestSensorData(Long sensorId) {
        // 取该传感器最近 50 条数据，然后按 sensorType 去重取最新
        List<SensorData> recentData = sensorDataMapper.selectList(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getSensorId, sensorId)
                        .orderByDesc(SensorData::getSampleAt)
                        .last("LIMIT 50"));

        Map<String, SensorData> latestByType = new LinkedHashMap<>();
        for (SensorData data : recentData) {
            latestByType.putIfAbsent(data.getSensorType(), data);
        }
        return new ArrayList<>(latestByType.values());
    }

    @Override
    public EnvHistoryVO getEnvHistory(String screenToken, Long greenhouseId, int limit) {
        ScreenDevice screen = authenticate(screenToken);
        Long resolvedId = resolveGreenhouseId(screen, greenhouseId);

        List<Plot> childPlots = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>()
                        .eq(Plot::getParentId, resolvedId));

        // 收集所有环境传感器 ID
        List<Long> envSensorIds = new ArrayList<>();
        for (Plot child : childPlots) {
            List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                    new LambdaQueryWrapper<SensorDevice>()
                            .eq(SensorDevice::getPlotId, child.getId()));
            for (SensorDevice s : sensors) {
                if (isEnvironmentSensor(s)) {
                    envSensorIds.add(s.getId());
                }
            }
        }

        int safeLimit = Math.min(Math.max(limit, 1), 200);

        Map<String, List<EnvHistoryVO.DataPoint>> series = new LinkedHashMap<>();

        if (!envSensorIds.isEmpty()) {
            // 查询这些传感器的最近 N 条数据
            List<SensorData> allData = sensorDataMapper.selectList(
                    new LambdaQueryWrapper<SensorData>()
                            .in(SensorData::getSensorId, envSensorIds)
                            .orderByDesc(SensorData::getSampleAt)
                            .last("LIMIT " + (safeLimit * 10)));

            // 按 sensorType 分组，每组取最近 limit 条，按时间升序
            Map<String, List<SensorData>> grouped = allData.stream()
                    .collect(Collectors.groupingBy(SensorData::getSensorType));

            for (Map.Entry<String, List<SensorData>> entry : grouped.entrySet()) {
                List<SensorData> typeData = entry.getValue();
                // 已经按 sampleAt DESC，取前 limit 条后翻转为 ASC
                List<SensorData> trimmed = typeData.stream()
                        .limit(safeLimit)
                        .collect(Collectors.toList());
                Collections.reverse(trimmed);

                List<EnvHistoryVO.DataPoint> points = trimmed.stream().map(sd -> {
                    EnvHistoryVO.DataPoint dp = new EnvHistoryVO.DataPoint();
                    dp.setValue(sd.getValue());
                    dp.setSampleAt(sd.getSampleAt() != null ? sd.getSampleAt().format(FMT) : null);
                    return dp;
                }).collect(Collectors.toList());

                series.put(entry.getKey(), points);
            }
        }

        EnvHistoryVO vo = new EnvHistoryVO();
        vo.setSeries(series);
        return vo;
    }

    @Override
    public GreenhouseListVO getGreenhouses(String screenToken) {
        ScreenDevice screen = authenticate(screenToken);
        Plot boundGh = plotMapper.selectById(screen.getPlotId());
        if (boundGh == null || boundGh.getFarmId() == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "找不到绑定的大棚信息");
        }

        // 查同农场下所有顶级 plot（即大棚，parentId 为空）
        List<Plot> allGreenhouses = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>()
                        .eq(Plot::getFarmId, boundGh.getFarmId())
                        .and(w -> w.isNull(Plot::getParentId).or().eq(Plot::getParentId, 0))
                        .orderByAsc(Plot::getId));

        // 过滤：只保留有子点位的（即真正的大棚，不是裸露田块）
        List<GreenhouseListVO.GreenhouseItem> items = new ArrayList<>();
        for (Plot gh : allGreenhouses) {
            long childCount = plotMapper.selectCount(
                    new LambdaQueryWrapper<Plot>().eq(Plot::getParentId, gh.getId()));
            if (childCount > 0) {
                GreenhouseListVO.GreenhouseItem item = new GreenhouseListVO.GreenhouseItem();
                item.setId(gh.getId());
                item.setName(gh.getPlotName());
                item.setPlotCount((int) childCount);
                items.add(item);
            }
        }

        GreenhouseListVO vo = new GreenhouseListVO();
        vo.setFarmName(boundGh.getFarmName());
        vo.setGreenhouses(items);
        return vo;
    }

    private boolean isEnvironmentSensor(SensorDevice sensor) {
        return "environment".equalsIgnoreCase(sensor.getCategory());
    }
}
