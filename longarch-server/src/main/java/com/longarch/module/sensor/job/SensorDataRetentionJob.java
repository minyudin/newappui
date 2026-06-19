package com.longarch.module.sensor.job;

import com.longarch.module.sensor.mapper.SensorDataMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * P-05：sensor_data 历史读数定时保留清理。
 *
 * sensor_data 由遥测逐指标 insert，只增不删，几周~数月后表膨胀 →
 * 查询变慢、连接占用更久、最终磁盘打满 MySQL 挂（炸服 #2）。
 *
 * 本任务每日按 sample_at 分批删除超过保留期的历史数据，
 * 把表大小/磁盘占用控制在上限内。分批 + 每批短事务，避免一条巨型
 * DELETE 长时间锁表、撑大 undo log 或拖垮连接池。
 *
 * 配置项（含默认值）：
 *   sensor.retention.enabled              默认 true（小磁盘服务器需要兜底保护）
 *   sensor.retention.days                 默认 90，保留最近 N 天
 *   sensor.retention.batch-size           默认 2000，单批删除行数
 *   sensor.retention.max-batches-per-run  默认 500，单次运行最多批次（防失控）
 *   sensor.retention.cron                 默认每天 03:30
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SensorDataRetentionJob {

    private final SensorDataMapper sensorDataMapper;

    @Value("${sensor.retention.enabled:true}")
    private boolean enabled;

    @Value("${sensor.retention.days:90}")
    private int retentionDays;

    @Value("${sensor.retention.batch-size:2000}")
    private int batchSize;

    @Value("${sensor.retention.max-batches-per-run:500}")
    private int maxBatchesPerRun;

    @Scheduled(cron = "${sensor.retention.cron:0 30 3 * * ?}")
    public void purgeExpired() {
        if (!enabled) {
            log.debug("sensor_data retention disabled, skipping");
            return;
        }
        if (retentionDays <= 0 || batchSize <= 0) {
            log.warn("Invalid retention config: days={}, batchSize={}, skipping", retentionDays, batchSize);
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        long totalDeleted = 0;
        int batches = 0;
        long startMs = System.currentTimeMillis();

        // 逐批删除，每批是独立短事务（无方法级 @Transactional），连接与行锁随批释放
        while (batches < maxBatchesPerRun) {
            int deleted = sensorDataMapper.deleteOlderThan(cutoff, batchSize);
            totalDeleted += deleted;
            batches++;
            if (deleted < batchSize) {
                break; // 没有更多过期行
            }
        }

        if (totalDeleted > 0) {
            log.info("sensor_data retention purged {} rows older than {} in {} batches ({} ms)",
                    totalDeleted, cutoff, batches, System.currentTimeMillis() - startMs);
            if (batches >= maxBatchesPerRun) {
                log.warn("sensor_data retention hit max batches ({}); remaining old rows will be purged next run",
                        maxBatchesPerRun);
            }
        }
    }
}
