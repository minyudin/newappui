package com.longarch.module.task.service;

import com.longarch.module.task.entity.OperationTask;

public interface SchedulerService {

    void schedule(OperationTask task);

    void dispatchNext(Long deviceId);
}
