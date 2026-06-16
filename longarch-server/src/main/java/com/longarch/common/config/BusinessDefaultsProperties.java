package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "business-defaults")
public class BusinessDefaultsProperties {

    private Long defaultFarmId = 1L;
    private String defaultFarmName = "陇上基地";

    private String userNoPrefix = "U";
    private String orderNoPrefix = "AO";
    private String adoptionCodePrefix = "LSGJ-";
    private String shareCodePrefix = "LSGJ-S-";
    private String plotNoPrefix = "PLOT-";
    private String cropBatchNoPrefix = "CB-";

    private List<String> defaultOperationWhitelist = List.of("irrigation_apply", "fertilize_apply");

    private String platformName = "陇上认养";
    private String aiAssistantName = "陇上管家";
    private String dashboardTitle = "韶山市稻梦田园智慧大棚监控平台";
    private String dashboardSubtitle = "银田镇 · 实时数据总览";
}
