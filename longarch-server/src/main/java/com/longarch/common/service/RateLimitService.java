package com.longarch.common.service;

import com.longarch.common.config.RateLimitProperties;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
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

    /**
     * 固定窗口限流并在超限时直接抛 429，集中复用各处样板逻辑。
     * 仅做一次 Redis INCR（窗口首请求加 TTL），开销极小；超限即拦截，
     * 避免公开接口/AI 调用在小容量服务器上无限堆积 CPU/线程/外网 IO。
     */
    public void enforce(String scene, String key, RateLimitProperties.Rule rule) {
        long count = incrementAndGet(key, rule.getWindowSeconds());
        if (count > rule.getLimit()) {
            recordHit(scene);
            log.warn("Rate limit hit: scene={}, key={}, count={}, limit={}, window={}s",
                    scene, key, count, rule.getLimit(), rule.getWindowSeconds());
            throw new BizException(ErrorCode.TOO_MANY_REQUESTS, "请求过于频繁，请稍后重试");
        }
    }

    public void recordHit(String scene) {
        if (meterRegistry == null) return;
        Counter.builder("longarch_rate_limit_hits_total")
                .tag("scene", scene)
                .register(meterRegistry)
                .increment();
    }
}

