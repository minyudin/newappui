package com.longarch.module.edge.service;

import com.longarch.module.edge.dto.EdgeRegisterReq;
import com.longarch.module.edge.dto.ExecutionCallbackReq;
import com.longarch.module.edge.dto.HeartbeatReq;
import com.longarch.module.edge.dto.SensorReportReq;

public interface EdgeNodeService {

    void register(EdgeRegisterReq req);

    void heartbeat(String nodeNo, HeartbeatReq req);

    void reportSensorData(SensorReportReq req);

    void executionCallback(ExecutionCallbackReq req);
}
