package com.longarch.module.edge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class SensorReportReq {

    @NotBlank(message = "节点编号不能为空")
    private String nodeNo;

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    private List<SensorItem> items;

    @Data
    public static class SensorItem {
        private Long sensorId;
        private String sensorType;
        private BigDecimal value;
        private String sampleAt;
    }
}
