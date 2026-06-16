package com.longarch.module.ai.guard;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.OperationTaskMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 权限守卫：AI创建任务前校验
 * - 用户对该地块是否有操作权限
 * - actionType 是否在白名单内
 * - 每日操作次数是否超限
 * - 当前是否在允许操作的时间窗口内
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PermissionGuard {

    private final AdoptionCodeMapper adoptionCodeMapper;
    private final OperationTaskMapper operationTaskMapper;
    private final ObjectMapper objectMapper;

    public PermissionCheckResult check(Long userId, Long plotId, String actionType) {
        PermissionCheckResult result = new PermissionCheckResult();

        // 1. 查找用户在该地块的认养码
        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getPlotId, plotId)
                        .eq(AdoptionCode::getStatus, "active")
                        .last("LIMIT 1"));

        if (code == null) {
            result.block("您没有该地块的有效认养码，无法执行操作");
            return result;
        }

        // 2. 检查认养码有效期
        LocalDateTime now = LocalDateTime.now();
        if (code.getValidFrom() != null && now.isBefore(code.getValidFrom())) {
            result.block("认养码尚未生效");
            return result;
        }
        if (code.getValidTo() != null && now.isAfter(code.getValidTo())) {
            result.block("认养码已过期");
            return result;
        }

        // 3. 检查操作权限
        if (code.getCanOperate() == null || code.getCanOperate() != 1) {
            result.block("您的认养码没有操作权限");
            return result;
        }

        // 4. 检查操作白名单
        if (code.getOperationWhitelist() != null) {
            try {
                List<String> whitelist = objectMapper.readValue(code.getOperationWhitelist(), new TypeReference<>() {});
                if (!whitelist.contains(actionType)) {
                    result.block(String.format("操作类型[%s]不在您的权限白名单内（允许: %s）", actionType, whitelist));
                    return result;
                }
            } catch (Exception e) {
                log.warn("Failed to parse operationWhitelist: {}", code.getOperationWhitelist(), e);
            }
        }

        // 5. 检查每日操作时间窗口
        LocalTime nowTime = LocalTime.now();
        if (code.getDailyAccessStart() != null && code.getDailyAccessEnd() != null) {
            if (nowTime.isBefore(code.getDailyAccessStart()) || nowTime.isAfter(code.getDailyAccessEnd())) {
                result.block(String.format("当前不在允许操作时段（%s ~ %s）",
                        code.getDailyAccessStart(), code.getDailyAccessEnd()));
                return result;
            }
        }

        // 6. 检查每日操作次数
        if (code.getMaxDailyOperations() != null && code.getMaxDailyOperations() > 0) {
            LocalDateTime todayStart = LocalDate.now().atStartOfDay();
            Long todayCount = operationTaskMapper.selectCount(
                    new LambdaQueryWrapper<OperationTask>()
                            .eq(OperationTask::getRequestUserId, userId)
                            .eq(OperationTask::getPlotId, plotId)
                            .ne(OperationTask::getTaskStatus, "cancelled")
                            .ge(OperationTask::getCreatedAt, todayStart));
            if (todayCount != null && todayCount >= code.getMaxDailyOperations()) {
                result.block(String.format("今日已操作%d次，已达上限%d次", todayCount, code.getMaxDailyOperations()));
                return result;
            }
            if (todayCount != null && todayCount >= code.getMaxDailyOperations() - 1) {
                result.warn(String.format("今日已操作%d次，剩余1次操作机会", todayCount));
            }
        }

        log.info("PermissionGuard PASS: userId={}, plotId={}, actionType={}", userId, plotId, actionType);
        return result;
    }

    public static class PermissionCheckResult {
        private boolean blocked = false;
        private final List<String> reasons = new ArrayList<>();
        private final List<String> warnings = new ArrayList<>();

        public void block(String reason) { blocked = true; reasons.add(reason); }
        public void warn(String warning) { warnings.add(warning); }
        public boolean isBlocked() { return blocked; }
        public List<String> getReasons() { return reasons; }
        public List<String> getWarnings() { return warnings; }

        public String getBlockMessage() {
            return blocked ? String.join("；", reasons) : null;
        }
    }
}
