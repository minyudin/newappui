package com.longarch.module.dashboard;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.config.MediaServerProperties;
import com.longarch.module.camera.entity.CameraDevice;
import com.longarch.module.camera.mapper.CameraDeviceMapper;
import com.longarch.module.dashboard.vo.DashboardOverviewVO;
import com.longarch.module.dashboard.vo.PlotDetailVO;
import com.longarch.module.dashboard.vo.SensorGroupVO;
import com.longarch.module.dashboard.vo.SensorHistoryVO;
import com.longarch.module.dashboard.vo.SensorSeriesVO;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final PlotMapper plotMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final CameraDeviceMapper cameraDeviceMapper;
    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final OperationTaskMapper operationTaskMapper;
    private final MediaServerProperties mediaServerProperties;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    /**
     * 综合总览：所有地块汇总
     */
    public DashboardOverviewVO getOverview() {
        DashboardOverviewVO vo = new DashboardOverviewVO();

        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getPlotStatus, "active")
                .orderByAsc(Plot::getId));

        List<DashboardOverviewVO.PlotSummary> summaries = new ArrayList<>();
        DashboardOverviewVO.DeviceStats totalStats = new DashboardOverviewVO.DeviceStats();

        for (Plot plot : plots) {
            DashboardOverviewVO.PlotSummary ps = new DashboardOverviewVO.PlotSummary();
            ps.setPlotId(plot.getId());
            ps.setPlotNo(plot.getPlotNo());
            ps.setPlotName(plot.getPlotName());
            ps.setLongitude(plot.getLongitude());
            ps.setLatitude(plot.getLatitude());

            // Sensors
            List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                    new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plot.getId()));
            ps.setSensorTotal(sensors.size());
            ps.setSensorOnline((int) sensors.stream().filter(s -> "online".equals(s.getStatus())).count());
            totalStats.setSensorTotal(totalStats.getSensorTotal() + sensors.size());
            totalStats.setSensorOnline(totalStats.getSensorOnline() + ps.getSensorOnline());

            // Env data from latest sensor readings
            ps.setEnvData(buildEnvData(plot.getId()));
            ps.setSoilData(buildSoilData(plot.getId()));

            // Cameras
            List<CameraDevice> cameras = cameraDeviceMapper.selectList(
                    new LambdaQueryWrapper<CameraDevice>().eq(CameraDevice::getPlotId, plot.getId()));
            ps.setCameraTotal(cameras.size());
            ps.setCameraOnline((int) cameras.stream().filter(c -> "online".equals(c.getNetworkStatus())).count());
            totalStats.setCameraTotal(totalStats.getCameraTotal() + cameras.size());
            totalStats.setCameraOnline(totalStats.getCameraOnline() + ps.getCameraOnline());

            // Actuators
            List<ActuatorDevice> actuators = actuatorDeviceMapper.selectList(
                    new LambdaQueryWrapper<ActuatorDevice>().eq(ActuatorDevice::getPlotId, plot.getId()));
            ps.setActuatorTotal(actuators.size());
            ps.setActuatorOnline((int) actuators.stream().filter(a -> "online".equals(a.getNetworkStatus())).count());
            totalStats.setActuatorTotal(totalStats.getActuatorTotal() + actuators.size());
            totalStats.setActuatorOnline(totalStats.getActuatorOnline() + ps.getActuatorOnline());

            summaries.add(ps);
        }

        vo.setPlots(summaries);
        vo.setDeviceStats(totalStats);

        // Recent events: latest 20 tasks across all plots
        List<OperationTask> tasks = operationTaskMapper.selectList(
                new LambdaQueryWrapper<OperationTask>()
                        .orderByDesc(OperationTask::getCreatedAt)
                        .last("LIMIT 20"));
        vo.setRecentEvents(tasks.stream().map(t -> {
            DashboardOverviewVO.RecentEvent e = new DashboardOverviewVO.RecentEvent();
            e.setType("task");
            e.setTitle(t.getActionType() + " - " + t.getTaskNo());
            e.setStatus(t.getTaskStatus());
            e.setTime(t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : "");
            return e;
        }).collect(Collectors.toList()));

        return vo;
    }

    /**
     * 单棚详情
     */
    public PlotDetailVO getPlotDetail(Long plotId) {
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) return null;

        PlotDetailVO vo = new PlotDetailVO();
        vo.setPlotId(plotId);
        vo.setPlotName(plot.getPlotName());

        // Env data
        PlotDetailVO.EnvData env = new PlotDetailVO.EnvData();
        DashboardOverviewVO.EnvData rawEnv = buildEnvData(plotId);
        if (rawEnv != null) {
            env.setTemperature(rawEnv.getTemperature());
            env.setHumidity(rawEnv.getHumidity());
            env.setLight(rawEnv.getLight());
            env.setCo2(rawEnv.getCo2());
        }
        // Find latest sample time for env sensors
        SensorData latestEnv = sensorDataMapper.selectOne(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getPlotId, plotId)
                        .in(SensorData::getSensorType, List.of("temperature", "humidity", "light", "co2",
                                "温度", "湿度", "光照", "CO2"))
                        .orderByDesc(SensorData::getSampleAt)
                        .last("LIMIT 1"));
        if (latestEnv != null) {
            env.setUpdatedAt(latestEnv.getSampleAt().format(FMT));
        }
        vo.setEnvData(env);

        // Soil data
        PlotDetailVO.SoilData soil = new PlotDetailVO.SoilData();
        DashboardOverviewVO.SoilData rawSoil = buildSoilData(plotId);
        if (rawSoil != null) {
            soil.setNitrogen(rawSoil.getNitrogen());
            soil.setPhosphorus(rawSoil.getPhosphorus());
            soil.setPotassium(rawSoil.getPotassium());
            soil.setPh(rawSoil.getPh());
            soil.setSoilTemperature(rawSoil.getSoilTemperature());
            soil.setSoilMoisture(rawSoil.getSoilMoisture());
        }
        SensorData latestSoil = sensorDataMapper.selectOne(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getPlotId, plotId)
                        .in(SensorData::getSensorType, List.of("nitrogen", "phosphorus", "potassium", "ph",
                                "soil_temperature", "soil_moisture", "氮", "磷", "钾", "pH",
                                "N", "P", "K", "soilTemp", "soilMoisture", "soil_humidity"))
                        .orderByDesc(SensorData::getSampleAt)
                        .last("LIMIT 1"));
        if (latestSoil != null) {
            soil.setUpdatedAt(latestSoil.getSampleAt().format(FMT));
        }
        vo.setSoilData(soil);

        // Camera
        CameraDevice camera = cameraDeviceMapper.selectOne(
                new LambdaQueryWrapper<CameraDevice>()
                        .eq(CameraDevice::getPlotId, plotId)
                        .last("LIMIT 1"));
        if (camera != null) {
            PlotDetailVO.CameraInfo ci = new PlotDetailVO.CameraInfo();
            ci.setId(camera.getId());
            ci.setDeviceNo(camera.getDeviceNo());
            ci.setCameraName(camera.getCameraName());
            ci.setNetworkStatus(camera.getNetworkStatus());
            // Build stream URL from config
            if ("online".equals(camera.getNetworkStatus()) && camera.getStreamApp() != null && camera.getStreamName() != null) {
                ci.setStreamUrl(mediaServerProperties.getHttpFlvBase() + "/" +
                        camera.getStreamApp() + "/" + camera.getStreamName() + ".flv");
            }
            vo.setCamera(ci);
        }

        // Actuators
        List<ActuatorDevice> actuators = actuatorDeviceMapper.selectList(
                new LambdaQueryWrapper<ActuatorDevice>().eq(ActuatorDevice::getPlotId, plotId));
        vo.setActuators(actuators.stream().map(a -> {
            PlotDetailVO.ActuatorInfo ai = new PlotDetailVO.ActuatorInfo();
            ai.setId(a.getId());
            ai.setDeviceNo(a.getDeviceNo());
            ai.setDeviceName(a.getDeviceName());
            ai.setDeviceType(a.getDeviceType());
            ai.setDeviceStatus(a.getDeviceStatus());
            ai.setNetworkStatus(a.getNetworkStatus());
            return ai;
        }).collect(Collectors.toList()));

        // Sensor groups (per-sensor granularity)
        List<SensorDevice> allSensors = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plotId));
        vo.setSensorGroups(allSensors.stream().map(s -> {
            SensorGroupVO sg = new SensorGroupVO();
            sg.setSensorId(s.getId());
            sg.setDeviceNo(s.getDeviceNo());
            sg.setSensorName(s.getSensorName());
            sg.setSensorType(s.getSensorType());
            sg.setCategory(s.getCategory());
            sg.setLatestValue(s.getLastValue());
            sg.setUnit(s.getUnit());
            sg.setStatus(s.getStatus());
            sg.setLastSampleAt(s.getLastSampleAt() != null ? s.getLastSampleAt().format(FMT) : null);
            return sg;
        }).collect(Collectors.toList()));

        // Recent tasks for this plot
        List<OperationTask> tasks = operationTaskMapper.selectList(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getPlotId, plotId)
                        .orderByDesc(OperationTask::getCreatedAt)
                        .last("LIMIT 20"));
        vo.setRecentTasks(tasks.stream().map(t -> {
            PlotDetailVO.TaskRecord tr = new PlotDetailVO.TaskRecord();
            tr.setId(t.getId());
            tr.setTaskNo(t.getTaskNo());
            tr.setActionType(t.getActionType());
            tr.setTaskStatus(t.getTaskStatus());
            // Resolve device name
            ActuatorDevice dev = actuatorDeviceMapper.selectById(t.getDeviceId());
            tr.setDeviceName(dev != null ? dev.getDeviceName() : "");
            tr.setCreatedAt(t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : "");
            return tr;
        }).collect(Collectors.toList()));

        return vo;
    }

    /**
     * 传感器历史数据（24h）
     */
    public SensorHistoryVO getSensorHistory(Long plotId) {
        SensorHistoryVO vo = new SensorHistoryVO();
        LocalDateTime since = LocalDateTime.now().minusHours(24);

        // env sensor types mapping (support both CN and EN keys)
        Map<String, List<String>> typeMapping = Map.of(
                "temperature", List.of("temperature", "温度"),
                "humidity", List.of("humidity", "湿度"),
                "light", List.of("light", "光照"),
                "co2", List.of("co2", "CO2")
        );

        vo.setTemperature(queryHistory(plotId, typeMapping.get("temperature"), since));
        vo.setHumidity(queryHistory(plotId, typeMapping.get("humidity"), since));
        vo.setLight(queryHistory(plotId, typeMapping.get("light"), since));
        vo.setCo2(queryHistory(plotId, typeMapping.get("co2"), since));

        // Per-sensor series for multi-sensor support
        List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plotId));
        List<SensorSeriesVO> seriesList = new ArrayList<>();
        for (SensorDevice sensor : sensors) {
            List<SensorData> records = sensorDataMapper.selectList(
                    new LambdaQueryWrapper<SensorData>()
                            .eq(SensorData::getSensorId, sensor.getId())
                            .ge(SensorData::getSampleAt, since)
                            .orderByAsc(SensorData::getSampleAt));
            if (!records.isEmpty()) {
                SensorSeriesVO sv = new SensorSeriesVO();
                sv.setSensorId(sensor.getId());
                sv.setSensorName(sensor.getSensorName());
                sv.setSensorType(sensor.getSensorType());
                sv.setCategory(sensor.getCategory());
                sv.setData(records.stream()
                        .map(r -> new SensorHistoryVO.DataPoint(
                                r.getSampleAt().format(TIME_FMT), r.getValue()))
                        .collect(Collectors.toList()));
                seriesList.add(sv);
            }
        }
        vo.setSeries(seriesList);

        return vo;
    }

    // ===== Private helpers =====

    private DashboardOverviewVO.EnvData buildEnvData(Long plotId) {
        DashboardOverviewVO.EnvData env = new DashboardOverviewVO.EnvData();
        env.setTemperature(getLatestValue(plotId, List.of("temperature", "温度")));
        env.setHumidity(getLatestValue(plotId, List.of("humidity", "湿度")));
        env.setLight(getLatestValue(plotId, List.of("light", "光照")));
        env.setCo2(getLatestValue(plotId, List.of("co2", "CO2")));
        return env;
    }

    private DashboardOverviewVO.SoilData buildSoilData(Long plotId) {
        DashboardOverviewVO.SoilData soil = new DashboardOverviewVO.SoilData();
        soil.setNitrogen(getLatestValue(plotId, List.of("nitrogen", "氮", "N")));
        soil.setPhosphorus(getLatestValue(plotId, List.of("phosphorus", "磷", "P")));
        soil.setPotassium(getLatestValue(plotId, List.of("potassium", "钾", "K")));
        soil.setPh(getLatestValue(plotId, List.of("ph", "pH")));
        soil.setSoilTemperature(getLatestValue(plotId, List.of("soil_temperature", "土温", "soilTemp")));
        soil.setSoilMoisture(getLatestValue(plotId, List.of("soil_moisture", "土湿", "soilMoisture", "soil_humidity")));
        return soil;
    }

    private BigDecimal getLatestValue(Long plotId, List<String> sensorTypes) {
        SensorData data = sensorDataMapper.selectOne(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getPlotId, plotId)
                        .in(SensorData::getSensorType, sensorTypes)
                        .orderByDesc(SensorData::getSampleAt)
                        .last("LIMIT 1"));
        return data != null ? data.getValue() : null;
    }

    private List<SensorHistoryVO.DataPoint> queryHistory(Long plotId, List<String> sensorTypes, LocalDateTime since) {
        List<SensorData> records = sensorDataMapper.selectList(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getPlotId, plotId)
                        .in(SensorData::getSensorType, sensorTypes)
                        .ge(SensorData::getSampleAt, since)
                        .orderByAsc(SensorData::getSampleAt));
        return records.stream()
                .map(r -> new SensorHistoryVO.DataPoint(
                        r.getSampleAt().format(TIME_FMT),
                        r.getValue()))
                .collect(Collectors.toList());
    }
}
