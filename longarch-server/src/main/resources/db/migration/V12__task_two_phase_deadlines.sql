-- V10: 引入两阶段回执(ACK + Result)的截止时间列
-- ------------------------------------------------------------
-- 目的:
--   · 快速失败 - ACK 阶段固定 10s, 覆盖"设备离线/网络断"
--   · 自适应失败 - Result 阶段随任务时长动态计算, 覆盖"设备卡死/执行异常"
--
-- 语义:
--   · dispatch 下发时同时写入两列, 并把 result_deadline_at 作为 command.expiresAt 发给设备
--   · 收到 accepted 回执 -> device_execution_state 变 running, ack_deadline_at 置 NULL
--   · 收到 success/failed -> 终态, 两列都置 NULL
--   · 定时器分两条扫描:
--       - ACK 扫描:  task_status=RUNNING AND device_execution_state=DISPATCHED AND ack_deadline_at < NOW()
--       - Result 扫描: task_status=RUNNING AND device_execution_state IN (running, network_pending_confirmation)
--                     AND result_deadline_at < NOW()

ALTER TABLE `operation_task`
    ADD COLUMN `ack_deadline_at`    DATETIME NULL DEFAULT NULL COMMENT 'ACK 阶段截止时间(设备需在此之前发 accepted 回执)'    AFTER `finished_at`,
    ADD COLUMN `result_deadline_at` DATETIME NULL DEFAULT NULL COMMENT 'Result 阶段截止时间(设备需在此之前发 success/failed)' AFTER `ack_deadline_at`;

-- 部分索引 (MySQL 8): 只对未终态且 deadline 非空的行建索引, 保持扫描 SQL 走索引
CREATE INDEX `idx_op_task_ack_deadline`    ON `operation_task` (`ack_deadline_at`);
CREATE INDEX `idx_op_task_result_deadline` ON `operation_task` (`result_deadline_at`);
