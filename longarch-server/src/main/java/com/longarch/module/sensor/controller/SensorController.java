package com.longarch.module.sensor.controller;

import com.longarch.common.result.R;
import com.longarch.module.sensor.service.SensorService;
import com.longarch.module.sensor.vo.SensorHistoryVO;
import com.longarch.module.sensor.vo.SensorSummaryVO;
import com.longarch.module.sensor.vo.SensorVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "传感器数据")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class SensorController {

    private final SensorService sensorService;

    @Operation(summary = "API-17 获取传感器列表")
    @GetMapping("/plots/{plotId}/sensors")
    public R<List<SensorVO>> sensorList(@PathVariable Long plotId) {
        return R.ok(sensorService.getSensorList(plotId));
    }

    @Operation(summary = "API-18 获取传感器数据摘要")
    @GetMapping("/plots/{plotId}/sensor-summary")
    public R<SensorSummaryVO> sensorSummary(@PathVariable Long plotId) {
        return R.ok(sensorService.getSensorSummary(plotId));
    }

    @Operation(summary = "API-19 获取传感器历史曲线")
    @GetMapping("/sensors/{sensorId}/history")
    public R<SensorHistoryVO> sensorHistory(
            @PathVariable Long sensorId,
            @RequestParam String startTime,
            @RequestParam String endTime,
            @RequestParam(defaultValue = "1h") String granularity) {
        return R.ok(sensorService.getSensorHistory(sensorId, startTime, endTime, granularity));
    }
}
