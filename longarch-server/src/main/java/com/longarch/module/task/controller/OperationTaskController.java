package com.longarch.module.task.controller;

import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.module.task.dto.CancelTaskReq;
import com.longarch.module.task.dto.CreateTaskReq;
import com.longarch.module.task.service.TaskService;
import com.longarch.module.task.vo.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "操作任务")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class OperationTaskController {

    private final TaskService taskService;

    @Operation(summary = "API-20 获取地块允许的操作列表")
    @GetMapping("/plots/{plotId}/allowed-actions")
    public R<AllowedActionsVO> allowedActions(@PathVariable Long plotId) {
        return R.ok(taskService.getAllowedActions(plotId));
    }

    @Operation(summary = "API-21 创建操作任务")
    @PostMapping("/operation-tasks")
    public R<CreateTaskVO> createTask(@Valid @RequestBody CreateTaskReq req) {
        return R.ok(taskService.createTask(req));
    }

    @Operation(summary = "API-22 获取我的任务列表")
    @GetMapping("/my/operation-tasks")
    public R<PageResult<TaskListVO>> myTasks(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String taskStatus) {
        return R.ok(taskService.getMyTasks(pageNo, pageSize, taskStatus));
    }

    @Operation(summary = "API-23 获取任务详情")
    @GetMapping("/operation-tasks/{taskId}")
    public R<TaskDetailVO> taskDetail(@PathVariable Long taskId) {
        return R.ok(taskService.getTaskDetail(taskId));
    }

    @Operation(summary = "API-24 轮询排队状态")
    @GetMapping("/operation-tasks/{taskId}/queue-status")
    public R<QueueStatusVO> queueStatus(@PathVariable Long taskId) {
        return R.ok(taskService.getQueueStatus(taskId));
    }

    @Operation(summary = "API-25 取消任务")
    @PostMapping("/operation-tasks/{taskId}/cancel")
    public R<CancelTaskVO> cancelTask(@PathVariable Long taskId, @RequestBody(required = false) CancelTaskReq req) {
        return R.ok(taskService.cancelTask(taskId, req));
    }
}
