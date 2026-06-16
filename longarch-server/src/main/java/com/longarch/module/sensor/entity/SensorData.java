package com.longarch.module.sensor.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("sensor_data")
public class SensorData {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long sensorId;
    private Long plotId;
    private String sensorType;
    @TableField("`value`")
    private BigDecimal value;
    private LocalDateTime sampleAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
