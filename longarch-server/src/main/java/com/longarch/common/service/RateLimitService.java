package com.longarch.common.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Nullable
    private final MeterRegistry meterRegistry;

    /**
     * Fixed-window rate limiter by Redis INCR + TTL.
     *
     * @return true if request is allowed.
     */
    public boolean allow(String key, int limit, int windowSeconds) {
        Long current = redisTemplate.opsForValue().increment(key);
        long count = current != null ? current : 0L;
        if (count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
        }
        return count <= limit;
    }

    public long incrementAndGet(String key, int windowSeconds) {
        Long current = redisTemplate.opsForValue().increment(key);
        long count = current != null ? current : 0L;
        if (count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(windowSeconds));
        }
        return count;
    }

    public void recordHit(String scene) {
        if (meterRegistry == null) return;
        Counter.builder("longarch_rate_limit_hits_total")
                .tag("scene", scene)
                .register(meterRegistry)
                .increment();
    }
}

