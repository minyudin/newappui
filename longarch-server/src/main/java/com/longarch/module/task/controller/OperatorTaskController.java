package com.longarch.module.task.controller;

import cn.dev33.satoken.annotation.SaCheckRole;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.enums.TaskStatus;
import com.longarch.module.task.dto.ReviewTaskReq;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.entity.OperatorPlotBinding;
import com.longarch.module.task.vo.OperatorPlotVO;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.mapper.OperatorPlotBindingMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.task.service.SchedulerService;
import com.longarch.module.task.vo.TaskListVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Tag(name = "运营执行（Operator）任务队列")
@SaCheckRole("operator")
@RestController
@RequestMapping("/api/v1/operator")
@RequiredArgsConstructor
public class OperatorTaskController {

    private final OperationTaskMapper taskMapper;
    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final OperatorPlotBindingMapper operatorPlotBindingMapper;
    private final PlotMapper plotMapper;
    private final SchedulerService schedulerService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Operation(summary = "查询 operator 队列任务（按 reviewState/assignee 过滤）")
    @GetMapping("/operation-tasks")
    public R<PageResult<TaskListVO>> list(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String reviewState,
            @RequestParam(required = false) String taskStatus,
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) Integer mine
    ) {
        Long userId = StpUtil.getLoginIdAsLong();
        List<Long> scopedPlotIds = loadScopedPlotIds(userId);
        if (scopedPlotIds.isEmpty()) {
            return R.ok(PageResult.of(List.of(), pageNo, pageSize, 0));
        }

        LambdaQueryWrapper<OperationTask> w = new LambdaQueryWrapper<OperationTask>()
                .orderByDesc(OperationTask::getCreatedAt);

        if (reviewState != null && !reviewState.isBlank()) w.eq(OperationTask::getReviewState, reviewState);
        if (taskStatus != null && !taskStatus.isBlank()) w.eq(OperationTask::getTaskStatus, taskStatus);
        if (plotId != null) {
            if (!scopedPlotIds.contains(plotId)) {
                throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "无权限查看该地块任务");
            }
            w.eq(OperationTask::getPlotId, plotId);
        } else {
            w.in(OperationTask::getPlotId, scopedPlotIds);
        }
        if (mine != null && mine == 1) w.eq(OperationTask::getAssigneeUserId, userId);

        Page<OperationTask> page = taskMapper.selectPage(new Page<>(pageNo, pageSize), w);
        var voList = page.getRecords().stream().map(t -> {
            TaskListVO vo = new TaskListVO();
            vo.setTaskId(t.getId());
            vo.setTaskNo(t.getTaskNo());
            vo.setPlotId(t.getPlotId());
            vo.setActionType(t.getActionType());
            vo.setTaskStatus(t.getTaskStatus());
            vo.setDeviceExecutionState(t.getDeviceExecutionState());
            vo.setQueueNo(t.getQueueNo());
            vo.setCreatedAt(t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : null);
            vo.setReviewState(t.getReviewState());
            vo.setRiskLevel(t.getRiskLevel());
            vo.setAssigneeUserId(t.getAssigneeUserId());
            return vo;
        }).collect(Collectors.toList());

        return R.ok(PageResult.from(page, voList));
    }

    @Operation(summary = "查询 operator 责任域内地块（我的地块）")
    @GetMapping("/plots")
    public R<PageResult<OperatorPlotVO>> listMyPlots(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "50") int pageSize
    ) {
        Long userId = StpUtil.getLoginIdAsLong();
        LocalDateTime now = LocalDateTime.now();

        Page<OperatorPlotBinding> page = operatorPlotBindingMapper.selectPage(
                new Page<>(pageNo, pageSize),
                new LambdaQueryWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getOperatorUserId, userId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .and(w -> w.isNull(OperatorPlotBinding::getValidFrom).or().le(OperatorPlotBinding::getValidFrom, now))
                        .and(w -> w.isNull(OperatorPlotBinding::getValidTo).or().ge(OperatorPlotBinding::getValidTo, now))
                        .orderByDesc(OperatorPlotBinding::getIsPrimary)
                        .orderByDesc(OperatorPlotBinding::getUpdatedAt)
        );

        List<Long> plotIds = page.getRecords().stream()
                .map(OperatorPlotBinding::getPlotId)
                .distinct()
                .collect(Collectors.toList());
        var plotNameMap = plotIds.isEmpty()
                ? java.util.Map.<Long, String>of()
                : plotMapper.selectBatchIds(plotIds).stream()
                .collect(Collectors.toMap(Plot::getId, Plot::getPlotName, (a, b) -> a));

        List<OperatorPlotVO> voList = page.getRecords().stream().map(b -> {
            OperatorPlotVO vo = new OperatorPlotVO();
            vo.setPlotId(b.getPlotId());
            vo.setPlotName(plotNameMap.getOrDefault(b.getPlotId(), "未知地块"));
            vo.setIsPrimary(b.getIsPrimary() != null ? b.getIsPrimary() : 0);
            return vo;
        }).collect(Collectors.toList());

        return R.ok(PageResult.from(page, voList));
    }

    @Operation(summary = "operator 认领任务")
    @PostMapping("/operation-tasks/{taskId}/claim")
    public R<Void> claim(@PathVariable Long taskId) {
        Long userId = StpUtil.getLoginIdAsLong();
        OperationTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        }
        ensureInScope(userId, task.getPlotId());
        int updated = taskMapper.update(null, new LambdaUpdateWrapper<OperationTask>()
                .eq(OperationTask::getId, taskId)
                .isNull(OperationTask::getAssigneeUserId)
                .set(OperationTask::getAssigneeUserId, userId)
                .set(OperationTask::getAssignmentMode, "manual")
                .set(OperationTask::getAssignedAt, LocalDateTime.now())
                .set(OperationTask::getAssignedBy, userId));
        if (updated == 0) {
            throw new BizException(ErrorCode.QUEUE_CONFLICT, "任务已被认领或不存在");
        }
        return R.ok(null);
    }

    @Operation(summary = "operator 审核任务（approve/reject）")
    @PostMapping("/operation-tasks/{taskId}/review")
    public R<Void> review(@PathVariable Long taskId, @Valid @RequestBody ReviewTaskReq req) {
        String decision = (req.getDecision() == null ? "" : req.getDecision()).trim().toLowerCase();
        if (!"approve".equals(decision) && !"reject".equals(decision)) {
            throw new BizException(ErrorCode.INVALID_PARAM, "decision 必须为 approve 或 reject");
        }

        OperationTask task = taskMapper.selectById(taskId);
        if (task == null) throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        ensureInScope(StpUtil.getLoginIdAsLong(), task.getPlotId());
        if (!"operator_required".equalsIgnoreCase(task.getReviewState())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "该任务不需要运营审核");
        }

        Long userId = StpUtil.getLoginIdAsLong();
        // 审核时自动认领（若未认领）
        if (task.getAssigneeUserId() == null) {
            taskMapper.update(null, new LambdaUpdateWrapper<OperationTask>()
                    .eq(OperationTask::getId, taskId)
                    .isNull(OperationTask::getAssigneeUserId)
                    .set(OperationTask::getAssigneeUserId, userId)
                    .set(OperationTask::getAssignmentMode, "manual")
                    .set(OperationTask::getAssignedAt, LocalDateTime.now())
                    .set(OperationTask::getAssignedBy, userId));
        }

        if ("reject".equals(decision)) {
            int updated = taskMapper.update(null, new LambdaUpdateWrapper<OperationTask>()
                    .eq(OperationTask::getId, taskId)
                    .eq(OperationTask::getTaskStatus, TaskStatus.PENDING.getValue())
                    .set(OperationTask::getReviewState, "rejected")
                    .set(OperationTask::getTaskStatus, TaskStatus.CANCELLED.getValue())
                    .set(OperationTask::getFinishedAt, LocalDateTime.now())
                    .set(OperationTask::getCancelable, 0)
                    .set(OperationTask::getFailReason, req.getReason()));
            if (updated == 0) {
                throw new BizException(ErrorCode.QUEUE_CONFLICT, "任务状态已变化，拒绝失败");
            }
            return R.ok(null);
        }

        // approve：把 review_state 标记为 approved，然后走现有调度（可能直接 dispatch 或入队）
        // 生产口径：即使 operator approve，也不允许对离线设备直接调度（避免无意义 publish）
        ActuatorDevice device = actuatorDeviceMapper.selectById(task.getDeviceId());
        if (device == null) {
            throw new BizException(ErrorCode.INVALID_PARAM, "设备不存在");
        }
        if (!isDeviceOnline(device)) {
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "设备未在线，暂不可通过审核");
        }

        int updated = taskMapper.update(null, new LambdaUpdateWrapper<OperationTask>()
                .eq(OperationTask::getId, taskId)
                .eq(OperationTask::getTaskStatus, TaskStatus.PENDING.getValue())
                .set(OperationTask::getReviewState, "approved")
                .set(OperationTask::getFailReason, null));
        if (updated == 0) {
            throw new BizException(ErrorCode.QUEUE_CONFLICT, "任务状态已变化，通过失败");
        }

        OperationTask latest = taskMapper.selectById(taskId);
        schedulerService.schedule(latest);
        return R.ok(null);
    }

    private boolean isDeviceOnline(ActuatorDevice device) {
        if (device == null || device.getDeviceStatus() == null) return false;
        String status = device.getDeviceStatus();
        return "online".equalsIgnoreCase(status)
                || "idle".equalsIgnoreCase(status)
                || "running".equalsIgnoreCase(status);
    }

    private List<Long> loadScopedPlotIds(Long operatorUserId) {
        LocalDateTime now = LocalDateTime.now();
        return operatorPlotBindingMapper.selectList(new LambdaQueryWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getOperatorUserId, operatorUserId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .and(w -> w.isNull(OperatorPlotBinding::getValidFrom).or().le(OperatorPlotBinding::getValidFrom, now))
                        .and(w -> w.isNull(OperatorPlotBinding::getValidTo).or().ge(OperatorPlotBinding::getValidTo, now)))
                .stream()
                .map(OperatorPlotBinding::getPlotId)
                .distinct()
                .collect(Collectors.toList());
    }

    private void ensureInScope(Long operatorUserId, Long plotId) {
        if (plotId == null || !loadScopedPlotIds(operatorUserId).contains(plotId)) {
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "不在该operator责任域内");
        }
    }
}

