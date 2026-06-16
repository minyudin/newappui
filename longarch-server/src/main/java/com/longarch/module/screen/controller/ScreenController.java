package com.longarch.module.screen.controller;

import com.longarch.common.result.R;
import com.longarch.module.screen.service.ScreenService;
import com.longarch.module.screen.vo.EnvHistoryVO;
import com.longarch.module.screen.vo.GreenhouseListVO;
import com.longarch.module.screen.vo.ScreenOverviewVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "大屏展示")
@RestController
@RequestMapping("/api/v1/screen")
@RequiredArgsConstructor
public class ScreenController {

    private final ScreenService screenService;

    @Operation(summary = "同农场大棚列表（切换器用）")
    @GetMapping("/greenhouses")
    public R<GreenhouseListVO> getGreenhouses(@RequestHeader("X-Screen-Token") String screenToken) {
        return R.ok(screenService.getGreenhouses(screenToken));
    }

    @Operation(summary = "API-46 大屏数据总览")
    @GetMapping("/overview")
    public R<ScreenOverviewVO> getOverview(
            @RequestHeader("X-Screen-Token") String screenToken,
            @RequestParam(required = false) Long greenhouseId) {
        return R.ok(screenService.getOverview(screenToken, greenhouseId));
    }

    @Operation(summary = "环境传感器历史数据（sparkline 用）")
    @GetMapping("/env-history")
    public R<EnvHistoryVO> getEnvHistory(
            @RequestHeader("X-Screen-Token") String screenToken,
            @RequestParam(required = false) Long greenhouseId,
            @RequestParam(defaultValue = "50") int limit) {
        return R.ok(screenService.getEnvHistory(screenToken, greenhouseId, limit));
    }
}
