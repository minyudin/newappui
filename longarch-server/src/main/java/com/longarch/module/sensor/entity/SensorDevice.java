package com.longarch.module.sensor.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("sensor_device")
public class SensorDevice {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String deviceNo;
    private String sensorName;
    private Long plotId;
    private String sensorType;
    private String category;
    private String unit;
    private String status;
    @TableField("`last_value`")
    private BigDecimal lastValue;
    private LocalDateTime lastSampleAt;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
