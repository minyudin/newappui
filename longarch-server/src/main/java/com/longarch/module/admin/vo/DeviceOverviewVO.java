package com.longarch.module.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class DeviceOverviewVO {

    private int totalPlots;
    private List<DeviceGroupStat> deviceStats;

    @Data
    public static class DeviceGroupStat {
        private String deviceType;
        private int total;
        private int online;
        private int offline;
        private int registered;
    }
}
