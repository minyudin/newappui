package com.longarch.module.task.service;

import com.longarch.common.result.PageResult;
import com.longarch.module.task.dto.CancelTaskReq;
import com.longarch.module.task.dto.CreateTaskReq;
import com.longarch.module.task.vo.*;

public interface TaskService {

    AllowedActionsVO getAllowedActions(Long plotId);

    CreateTaskVO createTask(CreateTaskReq req);

    PageResult<TaskListVO> getMyTasks(int pageNo, int pageSize, String taskStatus);

    TaskDetailVO getTaskDetail(Long taskId);

    QueueStatusVO getQueueStatus(Long taskId);

    CancelTaskVO cancelTask(Long taskId, CancelTaskReq req);
}
