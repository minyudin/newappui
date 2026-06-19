package com.longarch.module.task.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.common.enums.*;
import com.longarch.common.exception.BizException;
import com.longarch.common.metrics.DeviceObservabilityMetrics;
import com.longarch.common.result.PageResult;
import com.longarch.common.config.RateLimitProperties;
import com.longarch.common.service.RateLimitService;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.entity.AdoptionOrder;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.adoption.mapper.AdoptionOrderMapper;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.task.dto.CancelTaskReq;
import com.longarch.module.task.dto.CreateTaskReq;
import com.longarch.module.task.entity.*;
import com.longarch.module.task.mapper.*;
import com.longarch.module.task.service.SchedulerService;
import com.longarch.module.task.service.TaskService;
import com.longarch.module.task.vo.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLIntegrityConstraintViolationException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final OperationTaskMapper taskMapper;
    private final OperationTaskQueueMapper queueMapper;
    private final DeviceLockMapper deviceLockMapper;
    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final AdoptionCodeMapper adoptionCodeMapper;
    private final AdoptionOrderMapper adoptionOrderMapper;
    private final PlotMapper plotMapper;
    private final OperatorPlotBindingMapper operatorPlotBindingMapper;
    private final SchedulerService schedulerService;
    private final ObjectMapper objectMapper;
    private final RateLimitService rateLimitService;
    private final RateLimitProperties rateLimitProperties;
    private final DeviceObservabilityMetrics deviceObservabilityMetrics;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    // 设备类型兼容映射：以 Plots 页设备类型为主，同时兼容历史类型
    private static final Map<String, List<String>> ACTION_DEVICE_TYPE_COMPAT = Map.of(
            "irrigation_apply", List.of("fertigation_machine", "irrigator"),
            "fertilize_apply", List.of("fertigation_machine", "fertilizer"),
            "spray_apply", List.of("wet_curtain_controller", "sprayer", "fertigation_machine")
    );

    private static final String REVIEW_NONE = "none";
    private static final String REVIEW_OPERATOR_REQUIRED = "operator_required";
    private static final String REVIEW_APPROVED = "approved";
    private static final String REVIEW_REJECTED = "rejected";
    private static final String DISPATCH_MODE_AUTO = "auto";
    private static final String DISPATCH_MODE_DIRECT_OPERATOR = "direct_operator";

    @Override
    public AllowedActionsVO getAllowedActions(Long plotId) {
        Long userId = StpUtil.getLoginIdAsLong();

        AdoptionCode code = findActiveCode(userId, plotId);
        List<String> whitelist = parseWhitelist(code != null ? code.getOperationWhitelist() : null);
        boolean inTimeWindow = code != null && isInOperationTimeWindow(code);

        AllowedActionsVO vo = new AllowedActionsVO();
        vo.setPlotId(plotId);

        List<AllowedActionsVO.ActionItem> actions = new ArrayList<>();
        for (ActionType at : ActionType.values()) {
            AllowedActionsVO.ActionItem item = new AllowedActionsVO.ActionItem();
            item.setActionType(at.getValue());
            item.setActionName(at.getLabel());
            item.setRequiredParams(at.getRequiredParams());
            item.setOptionalParams(at.getOptionalParams());

            // 找该地块下匹配 deviceType 的第一个执行设备
            List<String> compatTypes = ACTION_DEVICE_TYPE_COMPAT.getOrDefault(
                    at.getValue(), List.of(at.getRequiredDeviceType()));
            ActuatorDevice device = actuatorDeviceMapper.selectOne(
                    new LambdaQueryWrapper<ActuatorDevice>()
                            .eq(ActuatorDevice::getPlotId, plotId)
                            .in(ActuatorDevice::getDeviceType, compatTypes)
                            .last("LIMIT 1"));
            if (device != null) {
                item.setDeviceId(device.getId());
                item.setDeviceName(device.getDeviceName());
            }

            if (code == null || code.getCanOperate() != 1) {
                item.setEnabled(false);
                item.setReason("当前权限不允许");
            } else if (!whitelist.contains(at.getValue())) {
                item.setEnabled(false);
                item.setReason("当前权限不允许");
            } else if (!inTimeWindow) {
                item.setEnabled(false);
                item.setReason("当前不在操作时间窗");
            } else if (device == null) {
                item.setEnabled(false);
                item.setReason("地块未配该类设备");
            } else if (!isDeviceOnline(device)) {
                item.setEnabled(false);
                item.setReason("设备未在线");
            } else {
                item.setEnabled(true);
                item.setReason("");
            }
            actions.add(item);
        }
        vo.setActions(actions);

        // 今日操作配额 (来自 adoption_code.max_daily_operations + 当日 task 表计数)
        // 与 createTask 的 Step 4 算法一致, 保证 UI 显示和实际放行严格一致
        if (code != null && code.getMaxDailyOperations() != null) {
            int limit = code.getMaxDailyOperations();
            long todayCount = taskMapper.selectCount(
                    new LambdaQueryWrapper<OperationTask>()
                            .eq(OperationTask::getRequestUserId, userId)
                            .eq(OperationTask::getPlotId, plotId)
                            .notIn(OperationTask::getTaskStatus,
                                    TaskStatus.CANCELLED.getValue(),
                                    TaskStatus.FAILED.getValue())
                            .ge(OperationTask::getCreatedAt, LocalDate.now().atStartOfDay()));
            int used = (int) Math.min(todayCount, Integer.MAX_VALUE);
            vo.setDailyLimit(limit);
            vo.setDailyUsed(used);
            vo.setDailyRemaining(Math.max(0, limit - used));
        }

        return vo;
    }

    @Override
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public CreateTaskVO createTask(CreateTaskReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        log.info("createTask userId={}, plotId={}, actionType={}, idempotencyKey={}",
                userId, req.getPlotId(), req.getActionType(), req.getIdempotencyKey());
        RateLimitProperties.Rule createTaskRule = rateLimitProperties.getCreateTask();
        String rlKey = "rl:task:create:user:" + userId;
        long reqCount = rateLimitService.incrementAndGet(rlKey, createTaskRule.getWindowSeconds());
        if (reqCount > createTaskRule.getLimit()) {
            rateLimitService.recordHit("createTask");
            log.warn("Rate limit hit: scene=createTask, key={}, count={}, limit={}, window={}s",
                    rlKey, reqCount, createTaskRule.getLimit(), createTaskRule.getWindowSeconds());
            throw new BizException(ErrorCode.TOO_MANY_REQUESTS, "创建任务请求过于频繁，请稍后重试");
        }

        // Step 1: 参数校验
        ActuatorDevice device = actuatorDeviceMapper.selectById(req.getDeviceId());
        if (device == null) {
            deviceObservabilityMetrics.recordGateDecision("deny", req.getActionType(), "missing", "missing");
            throw new BizException(ErrorCode.INVALID_PARAM, "设备不存在");
        }
        Plot plot = plotMapper.selectById(req.getPlotId());
        if (plot == null) {
            throw new BizException(ErrorCode.INVALID_PARAM, "地块不存在");
        }
        // S-03: 设备必须隶属于请求地块，避免持 A 地块权限的用户借 B 地块设备 id 越权下发
        if (!req.getPlotId().equals(device.getPlotId())) {
            deviceObservabilityMetrics.recordGateDecision("deny", req.getActionType(),
                    device.getDeviceStatus(), device.getNetworkStatus());
            throw new BizException(ErrorCode.INVALID_PARAM, "设备不属于该地块");
        }

        // 高风险判定（最小集）：离线/时间窗外/冲突 → 进入 operator 队列，不自动调度
        List<String> riskReasons = new ArrayList<>();
        String riskLevel = "low";
        String reviewState = REVIEW_NONE;
        String dispatchMode = normalizeDispatchMode(req.getDispatchMode());

        // Step 1.5: 设备类型必须匹配动作类型
        ActionType actionType = ActionType.fromValue(req.getActionType());
        if (actionType == null) {
            throw new BizException(ErrorCode.INVALID_PARAM, "不支持的动作类型: " + req.getActionType());
        }
        List<String> compatTypes = ACTION_DEVICE_TYPE_COMPAT.getOrDefault(
                actionType.getValue(), List.of(actionType.getRequiredDeviceType()));
        if (!compatTypes.contains(device.getDeviceType())) {
            deviceObservabilityMetrics.recordGateDecision(
                    "deny", req.getActionType(), device.getDeviceStatus(), device.getNetworkStatus());
            throw new BizException(ErrorCode.INVALID_PARAM,
                    "设备类型不匹配: 动作 " + actionType.getLabel() + " 需要 " + compatTypes
                            + " 类型设备，当前设备类型为 " + device.getDeviceType());
        }
        if (!isDeviceOnline(device)) {
            // 生产口径：允许提交“待人工处理”，进入 operator 队列，而不是让用户反复点
            riskReasons.add("device_offline");
            riskLevel = "high";
            reviewState = REVIEW_OPERATOR_REQUIRED;
        }
        deviceObservabilityMetrics.recordGateDecision(
                "allow", req.getActionType(), device.getDeviceStatus(), device.getNetworkStatus());

        // Step 1.6: 校验动作参数
        String paramError = actionType.validateParams(req.getActionParams());
        if (paramError != null) {
            throw new BizException(ErrorCode.INVALID_PARAM, paramError);
        }

        // Step 2: 身份与权限校验
        AdoptionCode code = findActiveCode(userId, req.getPlotId());
        if (code == null || code.getCanOperate() != 1) {
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "无操作权限");
        }
        AdoptionOrder order = adoptionOrderMapper.selectById(code.getOrderId());
        if (order == null || !"active".equals(order.getOrderStatus())) {
            throw new BizException(ErrorCode.ORDER_EXPIRED, "认养订单未生效或已失效");
        }
        List<String> whitelist = parseWhitelist(code.getOperationWhitelist());
        if (!whitelist.contains(req.getActionType())) {
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "当前动作不在允许范围内");
        }

        // Step 3: 时间窗校验
        if (!isInOperationTimeWindow(code)) {
            // 生产口径：可允许进入 operator 队列做“预约/改期/拒绝”
            riskReasons.add("out_of_time_window");
            riskLevel = "medium";
            reviewState = REVIEW_OPERATOR_REQUIRED;
        }

        // Step 4: 幂等校验——必须先于配额/冲突校验，保证额度用尽时携带同一 idempotencyKey 的重试仍能拿回已创建的任务。
        OperationTask existingTask = taskMapper.selectOne(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getIdempotencyKey, req.getIdempotencyKey()));
        if (existingTask != null) {
            // 命中时校验归属，防止他人复用同一 idempotencyKey 读到不属于自己的任务。
            if (existingTask.getRequestUserId() != null
                    && !existingTask.getRequestUserId().equals(userId)) {
                log.warn("Idempotency key reuse across users: key={}, owner={}, requester={}",
                        req.getIdempotencyKey(), existingTask.getRequestUserId(), userId);
                throw new BizException(ErrorCode.FORBIDDEN, "幂等键无效");
            }
            log.info("Idempotent hit: taskId={}", existingTask.getId());
            return buildCreateTaskVO(existingTask);
        }

        // Step 5: 操作次数校验
        long todayCount = taskMapper.selectCount(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getRequestUserId, userId)
                        .eq(OperationTask::getPlotId, req.getPlotId())
                        .notIn(OperationTask::getTaskStatus,
                                TaskStatus.CANCELLED.getValue(),
                                TaskStatus.FAILED.getValue())
                        .ge(OperationTask::getCreatedAt, LocalDate.now().atStartOfDay()));
        if (todayCount >= code.getMaxDailyOperations()) {
            throw new BizException(ErrorCode.TOO_MANY_REQUESTS, "今日操作次数已达上限");
        }

        // Step 6: 冲突检测
        long pendingCount = taskMapper.selectCount(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getDeviceId, req.getDeviceId())
                        .eq(OperationTask::getActionType, req.getActionType())
                        .eq(OperationTask::getRequestUserId, userId)
                        .in(OperationTask::getTaskStatus, "pending", "queued"));
        if (pendingCount > 0) {
            // 生产口径：同类冲突进入 operator 队列，由人工决定是否合并/拒绝
            riskReasons.add("conflict_pending");
            riskLevel = "medium";
            reviewState = REVIEW_OPERATOR_REQUIRED;
        }

        // Step 6.5: 用户主动选择“直派运营”
        if (DISPATCH_MODE_DIRECT_OPERATOR.equals(dispatchMode)) {
            if (!REVIEW_OPERATOR_REQUIRED.equalsIgnoreCase(reviewState)) {
                reviewState = REVIEW_OPERATOR_REQUIRED;
                riskLevel = "medium";
            }
            riskReasons.add("manual_direct_operator");
            if (req.getDirectOperatorReason() != null && !req.getDirectOperatorReason().isBlank()) {
                riskReasons.add("manual_reason:" + req.getDirectOperatorReason().trim());
            }
        }

        // Step 7: 创建任务
        OperationTask task = new OperationTask();
        task.setTaskNo("T" + IdUtil.getSnowflakeNextIdStr());
        task.setRequestUserId(userId);
        task.setPlotId(req.getPlotId());
        task.setDeviceId(req.getDeviceId());
        task.setActionType(req.getActionType());
        task.setSchedulingMode(req.getSchedulingMode());
        task.setIdempotencyKey(req.getIdempotencyKey());
        task.setPriority(10);
        task.setTaskStatus(TaskStatus.PENDING.getValue());
        task.setDeviceExecutionState(DeviceExecutionState.SUBMITTED.getValue());
        task.setCancelable(1);

        task.setReviewState(reviewState);
        task.setRiskLevel(riskLevel);
        if (REVIEW_OPERATOR_REQUIRED.equalsIgnoreCase(reviewState)) {
            Long primaryOperatorUserId = resolvePrimaryOperator(req.getPlotId());
            if (primaryOperatorUserId != null) {
                task.setAssigneeUserId(primaryOperatorUserId);
                task.setAssignmentMode("auto");
                task.setAssignedAt(LocalDateTime.now());
                task.setAssignedBy(0L);
            }
        }
        if (!riskReasons.isEmpty()) {
            try {
                task.setRiskReasons(objectMapper.writeValueAsString(riskReasons));
            } catch (Exception e) {
                task.setRiskReasons(String.join(",", riskReasons));
            }
        }

        try {
            if (req.getActionParams() != null) {
                task.setActionParams(objectMapper.writeValueAsString(req.getActionParams()));
            }
        } catch (Exception e) {
            log.warn("Failed to serialize actionParams", e);
        }

        if (req.getExpectedExecuteAt() != null) {
            task.setExpectedExecuteAt(LocalDateTime.parse(req.getExpectedExecuteAt(), FMT));
        }

        try {
            taskMapper.insert(task);
            log.info("Task created: taskId={}, taskNo={}", task.getId(), task.getTaskNo());
        } catch (Exception ex) {
            if (isIdempotencyDuplicateException(ex)) {
                // 并发同 idempotencyKey 场景：数据库唯一约束作为最终幂等兜底
                OperationTask duplicated = taskMapper.selectOne(
                        new LambdaQueryWrapper<OperationTask>()
                                .eq(OperationTask::getIdempotencyKey, req.getIdempotencyKey())
                                .last("LIMIT 1"));
                if (duplicated != null) {
                    if (duplicated.getRequestUserId() != null
                            && !duplicated.getRequestUserId().equals(userId)) {
                        log.warn("Idempotency key reuse across users (DB unique): key={}, owner={}, requester={}",
                                req.getIdempotencyKey(), duplicated.getRequestUserId(), userId);
                        throw new BizException(ErrorCode.FORBIDDEN, "幂等键无效");
                    }
                    log.info("Idempotent duplicate handled by DB unique index: taskId={}, key={}",
                            duplicated.getId(), req.getIdempotencyKey());
                    return buildCreateTaskVO(duplicated);
                }
            }
            throw ex;
        }

        // Step 8: 调度决策
        // 高风险/异常：进入 operator 队列，不自动调度（由 operator approve 后触发）
        if (!REVIEW_OPERATOR_REQUIRED.equalsIgnoreCase(task.getReviewState())) {
            schedulerService.schedule(task);
        }

        // Step 9: 重新查询返回最新状态
        task = taskMapper.selectById(task.getId());
        return buildCreateTaskVO(task);
    }

    @Override
    public PageResult<TaskListVO> getMyTasks(int pageNo, int pageSize, String taskStatus) {
        Long userId = StpUtil.getLoginIdAsLong();

        LambdaQueryWrapper<OperationTask> wrapper = new LambdaQueryWrapper<OperationTask>()
                .eq(OperationTask::getRequestUserId, userId)
                .orderByDesc(OperationTask::getCreatedAt);

        if (taskStatus != null && !taskStatus.isBlank()) {
            wrapper.eq(OperationTask::getTaskStatus, taskStatus);
        }

        Page<OperationTask> page = taskMapper.selectPage(new Page<>(pageNo, pageSize), wrapper);

        // 批量预取本页涉及的地块，避免逐条 selectById 的 N+1
        Map<Long, String> plotNameById = loadPlotNames(page.getRecords().stream()
                .map(OperationTask::getPlotId)
                .collect(Collectors.toList()));

        List<TaskListVO> voList = page.getRecords().stream().map(t -> {
            TaskListVO vo = new TaskListVO();
            vo.setTaskId(t.getId());
            vo.setTaskNo(t.getTaskNo());
            vo.setPlotId(t.getPlotId());
            vo.setActionType(t.getActionType());
            vo.setTaskStatus(t.getTaskStatus());
            vo.setDeviceExecutionState(t.getDeviceExecutionState());
            vo.setQueueNo(t.getQueueNo());
            vo.setCreatedAt(t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : null);

            ActionType at = ActionType.fromValue(t.getActionType());
            vo.setActionName(at != null ? at.getLabel() : t.getActionType());

            vo.setPlotName(t.getPlotId() != null ? plotNameById.get(t.getPlotId()) : null);
            return vo;
        }).collect(Collectors.toList());

        return PageResult.from(page, voList);
    }

    // S-02: 任务读路径归属校验，与 cancelTask 一致；放行任务发起人、被指派的处理人，以及后台/运维/农艺角色。
    private void assertCanReadTask(OperationTask task) {
        Long userId = StpUtil.getLoginIdAsLong();
        if (userId.equals(task.getRequestUserId()) || userId.equals(task.getAssigneeUserId())) {
            return;
        }
        Object roleType = StpUtil.getSession().get("roleType");
        if (roleType != null) {
            String rt = roleType.toString();
            if ("admin".equals(rt) || "operator".equals(rt) || "agronomist".equals(rt)) {
                return;
            }
        }
        throw new BizException(ErrorCode.FORBIDDEN, "无权查看该任务");
    }

    @Override
    public TaskDetailVO getTaskDetail(Long taskId) {
        OperationTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        }
        assertCanReadTask(task);

        TaskDetailVO vo = new TaskDetailVO();
        vo.setTaskId(task.getId());
        vo.setTaskNo(task.getTaskNo());
        vo.setRequestUserId(task.getRequestUserId());
        vo.setPlotId(task.getPlotId());
        vo.setDeviceId(task.getDeviceId());
        vo.setActionType(task.getActionType());
        vo.setSchedulingMode(task.getSchedulingMode());
        vo.setPriority(task.getPriority());
        vo.setTaskStatus(task.getTaskStatus());
        vo.setDeviceExecutionState(task.getDeviceExecutionState());
        vo.setQueueNo(task.getQueueNo());
        vo.setEstimatedWaitMinutes(task.getEstimatedWaitMinutes());
        vo.setFailReason(task.getFailReason());
        vo.setCreatedAt(task.getCreatedAt() != null ? task.getCreatedAt().format(FMT) : null);
        vo.setQueuedAt(task.getQueuedAt() != null ? task.getQueuedAt().format(FMT) : null);
        vo.setStartedAt(task.getStartedAt() != null ? task.getStartedAt().format(FMT) : null);
        vo.setFinishedAt(task.getFinishedAt() != null ? task.getFinishedAt().format(FMT) : null);
        vo.setCancelable(task.getCancelable() == 1);
        vo.setReviewState(task.getReviewState());
        vo.setRiskLevel(task.getRiskLevel());
        vo.setRiskReasons(task.getRiskReasons());
        vo.setAssigneeUserId(task.getAssigneeUserId());

        ActionType at = ActionType.fromValue(task.getActionType());
        vo.setActionName(at != null ? at.getLabel() : task.getActionType());

        Plot plot = plotMapper.selectById(task.getPlotId());
        vo.setPlotName(plot != null ? plot.getPlotName() : null);

        ActuatorDevice dev = actuatorDeviceMapper.selectById(task.getDeviceId());
        vo.setDeviceName(dev != null ? dev.getDeviceName() : null);

        try {
            if (task.getActionParams() != null) {
                vo.setActionParams(objectMapper.readValue(task.getActionParams(), new TypeReference<>() {}));
            }
        } catch (Exception e) {
            log.warn("Failed to parse actionParams", e);
        }

        return vo;
    }

    @Override
    public QueueStatusVO getQueueStatus(Long taskId) {
        OperationTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        }

        assertCanReadTask(task);

        QueueStatusVO vo = new QueueStatusVO();
        vo.setTaskId(task.getId());
        vo.setTaskStatus(task.getTaskStatus());
        vo.setQueueNo(task.getQueueNo());
        vo.setEstimatedWaitMinutes(task.getEstimatedWaitMinutes());

        DeviceLock lock = deviceLockMapper.selectOne(
                new LambdaQueryWrapper<DeviceLock>().eq(DeviceLock::getDeviceId, task.getDeviceId()));
        vo.setDeviceBusy(lock != null && "locked".equals(lock.getLockStatus()));
        vo.setCurrentRunningTaskId(lock != null ? lock.getCurrentTaskId() : null);

        return vo;
    }

    @Override
    @Transactional
    public CancelTaskVO cancelTask(Long taskId, CancelTaskReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        OperationTask task = taskMapper.selectById(taskId);

        if (task == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        }
        if (!userId.equals(task.getRequestUserId())) {
            throw new BizException(ErrorCode.FORBIDDEN, "只能取消自己的任务");
        }

        TaskStatus status = TaskStatus.valueOf(task.getTaskStatus().toUpperCase());
        if (!status.isCancelable()) {
            throw new BizException(ErrorCode.TASK_NOT_CANCELABLE, "当前任务状态不可取消");
        }

        int updated = taskMapper.update(null,
                new LambdaUpdateWrapper<OperationTask>()
                        .eq(OperationTask::getId, taskId)
                        .eq(OperationTask::getRequestUserId, userId)
                        .eq(OperationTask::getCancelable, 1)
                        .in(OperationTask::getTaskStatus,
                                TaskStatus.PENDING.getValue(),
                                TaskStatus.QUEUED.getValue())
                        .set(OperationTask::getTaskStatus, TaskStatus.CANCELLED.getValue())
                        .set(OperationTask::getCancelable, 0)
                        .set(OperationTask::getFinishedAt, LocalDateTime.now())
                        .set(OperationTask::getFailReason, req != null ? req.getReason() : null));
        if (updated == 0) {
            throw new BizException(ErrorCode.TASK_NOT_CANCELABLE, "任务状态已变化，取消失败");
        }

        // 从队列中移除
        queueMapper.delete(
                new LambdaQueryWrapper<OperationTaskQueue>()
                        .eq(OperationTaskQueue::getTaskId, taskId));

        log.info("Task cancelled: taskId={}, reason={}", taskId, req != null ? req.getReason() : "");

        CancelTaskVO vo = new CancelTaskVO();
        vo.setTaskId(taskId);
        vo.setTaskStatus(TaskStatus.CANCELLED.getValue());
        return vo;
    }

    /** 批量按 id 取地块名，去重 + 单次 IN 查询，避免 N+1 */
    private Map<Long, String> loadPlotNames(Collection<Long> plotIds) {
        Set<Long> ids = plotIds.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        return plotMapper.selectList(
                        new LambdaQueryWrapper<Plot>()
                                .select(Plot::getId, Plot::getPlotName)
                                .in(Plot::getId, ids))
                .stream()
                .collect(Collectors.toMap(Plot::getId, Plot::getPlotName, (a, b) -> a));
    }

    private CreateTaskVO buildCreateTaskVO(OperationTask task) {
        CreateTaskVO vo = new CreateTaskVO();
        vo.setTaskId(task.getId());
        vo.setTaskNo(task.getTaskNo());
        vo.setTaskStatus(task.getTaskStatus());
        vo.setQueueNo(task.getQueueNo());
        vo.setEstimatedWaitMinutes(task.getEstimatedWaitMinutes());
        vo.setDeviceExecutionState(task.getDeviceExecutionState());
        vo.setReviewState(task.getReviewState());
        vo.setRiskLevel(task.getRiskLevel());
        vo.setRiskReasons(task.getRiskReasons());
        if (REVIEW_OPERATOR_REQUIRED.equalsIgnoreCase(task.getReviewState())) {
            vo.setMessage("任务已提交，等待运营确认");
        } else {
            vo.setMessage("queued".equals(task.getTaskStatus()) ? "任务已提交并进入队列" : "任务已提交");
        }
        return vo;
    }

    private AdoptionCode findActiveCode(Long userId, Long plotId) {
        return adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getPlotId, plotId)
                        .eq(AdoptionCode::getStatus, "active")
                        // 全链路口径统一：按 bind_user_id 取最新 order_id 的 active 码（兼容 guest/share）
                        .apply("order_id = (SELECT MAX(ac2.order_id) FROM adoption_code ac2 WHERE ac2.bind_user_id = {0} AND ac2.plot_id = {1} AND ac2.status = 'active')", userId, plotId)
                        .orderByDesc(AdoptionCode::getId)
                        .last("LIMIT 1"));
    }

    private boolean isInOperationTimeWindow(AdoptionCode code) {
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(code.getValidFrom()) || now.isAfter(code.getValidTo())) {
            return false;
        }
        if (code.getDailyAccessStart() != null && code.getDailyAccessEnd() != null) {
            LocalTime currentTime = now.toLocalTime();
            return !currentTime.isBefore(code.getDailyAccessStart()) && !currentTime.isAfter(code.getDailyAccessEnd());
        }
        return true;
    }

    private boolean isDeviceOnline(ActuatorDevice device) {
        if (device == null) {
            return false;
        }
        String status = device.getDeviceStatus();
        if (status == null) {
            return false;
        }
        return "online".equalsIgnoreCase(status)
                || "idle".equalsIgnoreCase(status)
                || "running".equalsIgnoreCase(status);
    }

    private boolean looksLikeFalseNegative(ActuatorDevice device) {
        if (device == null) {
            return false;
        }
        if (!"online".equalsIgnoreCase(device.getNetworkStatus())) {
            return false;
        }
        LocalDateTime heartbeatAt = device.getLastHeartbeatAt();
        if (heartbeatAt == null) {
            return false;
        }
        return heartbeatAt.isAfter(LocalDateTime.now().minusSeconds(90));
    }

    private List<String> parseWhitelist(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private boolean isIdempotencyDuplicateException(Throwable ex) {
        Throwable cur = ex;
        while (cur != null) {
            if (cur instanceof DuplicateKeyException || cur instanceof SQLIntegrityConstraintViolationException) {
                return true;
            }
            String msg = cur.getMessage();
            if (msg != null
                    && msg.contains("Duplicate entry")
                    && msg.contains("uk_idempotency_key")) {
                return true;
            }
            cur = cur.getCause();
        }
        return false;
    }

    private Long resolvePrimaryOperator(Long plotId) {
        if (plotId == null) {
            return null;
        }
        LocalDateTime now = LocalDateTime.now();
        OperatorPlotBinding primary = operatorPlotBindingMapper.selectOne(
                new LambdaQueryWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getPlotId, plotId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .eq(OperatorPlotBinding::getIsPrimary, 1)
                        .and(w -> w.isNull(OperatorPlotBinding::getValidFrom).or().le(OperatorPlotBinding::getValidFrom, now))
                        .and(w -> w.isNull(OperatorPlotBinding::getValidTo).or().ge(OperatorPlotBinding::getValidTo, now))
                        .orderByDesc(OperatorPlotBinding::getUpdatedAt)
                        .last("LIMIT 1"));
        if (primary != null) {
            return primary.getOperatorUserId();
        }
        OperatorPlotBinding fallback = operatorPlotBindingMapper.selectOne(
                new LambdaQueryWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getPlotId, plotId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .and(w -> w.isNull(OperatorPlotBinding::getValidFrom).or().le(OperatorPlotBinding::getValidFrom, now))
                        .and(w -> w.isNull(OperatorPlotBinding::getValidTo).or().ge(OperatorPlotBinding::getValidTo, now))
                        .orderByDesc(OperatorPlotBinding::getUpdatedAt)
                        .last("LIMIT 1"));
        return fallback != null ? fallback.getOperatorUserId() : null;
    }

    private String normalizeDispatchMode(String dispatchMode) {
        if (dispatchMode == null || dispatchMode.isBlank()) {
            return DISPATCH_MODE_AUTO;
        }
        String normalized = dispatchMode.trim().toLowerCase();
        if (!DISPATCH_MODE_AUTO.equals(normalized) && !DISPATCH_MODE_DIRECT_OPERATOR.equals(normalized)) {
            throw new BizException(ErrorCode.INVALID_PARAM, "不支持的任务分发模式: " + dispatchMode);
        }
        return normalized;
    }
}
