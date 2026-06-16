package com.longarch.module.edge.controller;

import com.longarch.common.result.R;
import com.longarch.module.edge.dto.EdgeRegisterReq;
import com.longarch.module.edge.dto.ExecutionCallbackReq;
import com.longarch.module.edge.dto.HeartbeatReq;
import com.longarch.module.edge.dto.SensorReportReq;
import com.longarch.module.edge.service.EdgeNodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "边缘节点")
@RestController
@RequestMapping("/api/v1/edge")
@RequiredArgsConstructor
public class EdgeController {

    private final EdgeNodeService edgeNodeService;

    @Operation(summary = "API-36 边缘节点注册")
    @PostMapping("/nodes/register")
    public R<Void> register(@Valid @RequestBody EdgeRegisterReq req) {
        edgeNodeService.register(req);
        return R.ok();
    }

    @Operation(summary = "API-37 边缘节点心跳")
    @PostMapping("/nodes/{nodeNo}/heartbeat")
    public R<Void> heartbeat(@PathVariable String nodeNo, @RequestBody HeartbeatReq req) {
        edgeNodeService.heartbeat(nodeNo, req);
        return R.ok();
    }

    @Operation(summary = "API-38 传感器数据上报")
    @PostMapping("/sensor-data/report")
    public R<Void> reportSensorData(@Valid @RequestBody SensorReportReq req) {
        edgeNodeService.reportSensorData(req);
        return R.ok();
    }

    @Operation(summary = "API-39 执行回执")
    @PostMapping("/execution-callbacks")
    public R<Void> executionCallback(@Valid @RequestBody ExecutionCallbackReq req) {
        edgeNodeService.executionCallback(req);
        return R.ok();
    }
}
