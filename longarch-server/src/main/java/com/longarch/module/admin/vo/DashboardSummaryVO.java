package com.longarch.module.admin.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 管理后台仪表盘聚合数据。
 * <p>
 * 原前端 DashboardPage / useGlobalAlerts 各自拉取 orders/tasks/devices(100) +
 * sensors(200) 整页数据，在浏览器里 filter/count 做聚合——既截断（超过页大小就漏数），
 * 又在 15~30s 刷新间隔里反复传输上百行。这里改为后端用 COUNT/GROUP BY/小 LIMIT
 * 一次算好，返回精简结果，省小服务器的查询与带宽开销。
 */
@Data
public class DashboardSummaryVO {

    /** KPI 六卡总数（全量精确计数，不再受分页截断）。 */
    private Kpi kpi;

    /** 任务状态分布（taskStatus -> count），用于饼图。 */
    private Map<String, Long> taskStatusCounts;

    /** 进行中任务数（queued + running），用于页面 lede。 */
    private long pendingTaskCount;

    private long sensorTotal;
    private long actuatorTotal;

    private long offlineSensorCount;
    private long lockedDeviceCount;
    private long failedTaskCount;

    /** 离线传感器前 N 条（用于异常清单）。 */
    private List<OfflineSensor> offlineSensors;

    /** 锁定执行设备前 N 条。 */
    private List<LockedDevice> lockedDevices;

    /** 失败任务前 N 条（复用任务列表 VO 字段）。 */
    private List<TaskListVO> failedTasks;

    /** 最近任务（created_at 倒序）前 N 条。 */
    private List<TaskListVO> recentTasks;

    @Data
    public static class Kpi {
        private long users;
        private long orders;
        private long codes;
        private long plots;
        private long devices;
        private long tasks;
    }

    @Data
    public static class OfflineSensor {
        private Long sensorId;
        private String sensorName;
        private String deviceNo;
        private String lastSampleAt;
    }

    @Data
    public static class LockedDevice {
        private Long deviceId;
        private String deviceName;
        private String deviceNo;
        private String plotName;
        private Long currentTaskId;
    }
}
