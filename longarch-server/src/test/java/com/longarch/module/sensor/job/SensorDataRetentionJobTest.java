package com.longarch.module.sensor.job;

import com.longarch.module.sensor.mapper.SensorDataMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 验证 P-05 保留任务的分批循环与开关/上限保护（不依赖具体 DB 方言）。
 */
class SensorDataRetentionJobTest {

    private SensorDataRetentionJob newJob(SensorDataMapper mapper, boolean enabled,
                                          int days, int batchSize, int maxBatches) {
        SensorDataRetentionJob job = new SensorDataRetentionJob(mapper);
        ReflectionTestUtils.setField(job, "enabled", enabled);
        ReflectionTestUtils.setField(job, "retentionDays", days);
        ReflectionTestUtils.setField(job, "batchSize", batchSize);
        ReflectionTestUtils.setField(job, "maxBatchesPerRun", maxBatches);
        return job;
    }

    @Test
    void disabled_doesNotTouchDatabase() {
        SensorDataMapper mapper = mock(SensorDataMapper.class);
        newJob(mapper, false, 90, 2000, 500).purgeExpired();
        verify(mapper, never()).deleteOlderThan(any(), anyInt());
    }

    @Test
    void stopsWhenBatchNotFull() {
        SensorDataMapper mapper = mock(SensorDataMapper.class);
        // 前两批删满，第三批不足 → 停止
        when(mapper.deleteOlderThan(any(LocalDateTime.class), eq(2000)))
                .thenReturn(2000, 2000, 137);

        newJob(mapper, true, 90, 2000, 500).purgeExpired();

        verify(mapper, times(3)).deleteOlderThan(any(LocalDateTime.class), eq(2000));
    }

    @Test
    void respectsMaxBatchesGuard() {
        SensorDataMapper mapper = mock(SensorDataMapper.class);
        // 永远删满 → 受 maxBatchesPerRun 上限保护，不会无限循环
        when(mapper.deleteOlderThan(any(LocalDateTime.class), anyInt())).thenReturn(500);

        newJob(mapper, true, 90, 500, 3).purgeExpired();

        verify(mapper, times(3)).deleteOlderThan(any(LocalDateTime.class), anyInt());
    }

    @Test
    void invalidConfig_skips() {
        SensorDataMapper mapper = mock(SensorDataMapper.class);
        newJob(mapper, true, 0, 2000, 500).purgeExpired();
        verify(mapper, never()).deleteOlderThan(any(), anyInt());
    }
}
