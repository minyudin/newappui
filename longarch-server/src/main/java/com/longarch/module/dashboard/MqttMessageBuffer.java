package com.longarch.module.dashboard;

import lombok.Data;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Component
public class MqttMessageBuffer {

    private static final int MAX_SIZE = 200;

    private final MqttLogEntry[] buffer = new MqttLogEntry[MAX_SIZE];
    private int head = 0;
    private int count = 0;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Data
    public static class MqttLogEntry {
        private long timestamp;
        private String direction;
        private String topic;
        private String payload;
        private String deviceNo;
        private Long plotId;
    }

    public void add(MqttLogEntry entry) {
        lock.writeLock().lock();
        try {
            buffer[head] = entry;
            head = (head + 1) % MAX_SIZE;
            if (count < MAX_SIZE) {
                count++;
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    public List<MqttLogEntry> getSince(long sinceTimestamp, Long plotId) {
        lock.readLock().lock();
        try {
            List<MqttLogEntry> result = new ArrayList<>();
            int start = (head - count + MAX_SIZE) % MAX_SIZE;
            for (int i = 0; i < count; i++) {
                MqttLogEntry entry = buffer[(start + i) % MAX_SIZE];
                if (entry == null) continue;
                if (entry.getTimestamp() <= sinceTimestamp) continue;
                if (plotId != null && entry.getPlotId() != null && !plotId.equals(entry.getPlotId())) continue;
                result.add(entry);
            }
            return result;
        } finally {
            lock.readLock().unlock();
        }
    }
}
