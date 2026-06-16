package com.longarch.module.dashboard;

import com.longarch.common.config.BusinessDefaultsProperties;
import com.longarch.common.config.DashboardProperties;
import com.longarch.common.result.R;
import com.longarch.module.dashboard.vo.DashboardOverviewVO;
import com.longarch.module.dashboard.vo.PlotDetailVO;
import com.longarch.module.dashboard.vo.SensorHistoryVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final DashboardProperties dashboardProperties;
    private final BusinessDefaultsProperties bizDefaults;
    private final MqttMessageBuffer mqttMessageBuffer;

    @GetMapping("/overview")
    public R<DashboardOverviewVO> overview(@RequestHeader(value = "X-Dashboard-Token", required = false) String token) {
        if (!validateToken(token)) {
            return R.fail(401, "Invalid dashboard token");
        }
        return R.ok(dashboardService.getOverview());
    }

    @GetMapping("/plots/{plotId}/detail")
    public R<PlotDetailVO> plotDetail(@PathVariable Long plotId,
                                      @RequestHeader(value = "X-Dashboard-Token", required = false) String token) {
        if (!validateToken(token)) {
            return R.fail(401, "Invalid dashboard token");
        }
        PlotDetailVO detail = dashboardService.getPlotDetail(plotId);
        if (detail == null) {
            return R.fail(404, "Plot not found");
        }
        return R.ok(detail);
    }

    @GetMapping("/plots/{plotId}/sensor-history")
    public R<SensorHistoryVO> sensorHistory(@PathVariable Long plotId,
                                            @RequestHeader(value = "X-Dashboard-Token", required = false) String token) {
        if (!validateToken(token)) {
            return R.fail(401, "Invalid dashboard token");
        }
        return R.ok(dashboardService.getSensorHistory(plotId));
    }

    @GetMapping("/mqtt-log")
    public R<List<MqttMessageBuffer.MqttLogEntry>> mqttLog(
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false, defaultValue = "0") Long since,
            @RequestHeader(value = "X-Dashboard-Token", required = false) String token) {
        if (!validateToken(token)) {
            return R.fail(401, "Invalid dashboard token");
        }
        return R.ok(mqttMessageBuffer.getSince(since, plotId));
    }

    @GetMapping("/config")
    public R<java.util.Map<String, String>> platformConfig(
            @RequestHeader(value = "X-Dashboard-Token", required = false) String token) {
        if (!validateToken(token)) {
            return R.fail(401, "Invalid dashboard token");
        }
        return R.ok(java.util.Map.of(
                "platformName", bizDefaults.getPlatformName(),
                "dashboardTitle", bizDefaults.getDashboardTitle(),
                "dashboardSubtitle", bizDefaults.getDashboardSubtitle()
        ));
    }

    private boolean validateToken(String token) {
        String expected = dashboardProperties.getToken();
        if (expected == null || expected.isBlank()) {
            return true;
        }
        return expected.equals(token);
    }
}
