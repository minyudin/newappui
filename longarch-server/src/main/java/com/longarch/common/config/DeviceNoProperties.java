package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "device-no")
public class DeviceNoProperties {

    private String cameraPrefix = "CAM-";
    private String sensorPrefix = "SEN-";
    private String actuatorPrefix = "ACT-";
    private String screenPrefix = "SCR-";
    private int randomSuffixLength = 6;
}
