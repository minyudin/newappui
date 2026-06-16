-- ============================================================
-- V11 · 性能复合索引（P-02 / P-03）
-- ------------------------------------------------------------
-- 目的：为热点查询补充覆盖式复合索引，降低小规格服务器上的
--       行扫描量与连接占用时长。纯增量、幂等，不改数据/结构。
--
--   ① operation_task：每日配额 count 查询
--      TaskServiceImpl.createTask Step4 过滤
--        request_user_id = ? AND plot_id = ? AND created_at >= ?
--      现有 idx_user_id(request_user_id) 仅命中首列，仍需回表过滤
--      plot_id / created_at。新增 (request_user_id, plot_id, created_at)
--      让等值 + 范围一次走完。
--
--   ② adoption_code：findActiveCode / AccessScope 判权
--      过滤 bind_user_id = ? AND plot_id = ? AND status = 'active'
--      现有 idx_bind_user_id 仅命中首列。新增
--      (bind_user_id, plot_id, status) 覆盖三等值条件。
-- ============================================================

-- ① operation_task (request_user_id, plot_id, created_at)
SET @idx_task_quota_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND index_name = 'idx_task_user_plot_created'
);
SET @ddl_idx_task_quota := IF(@idx_task_quota_exists = 0,
    'ALTER TABLE operation_task ADD INDEX idx_task_user_plot_created (request_user_id, plot_id, created_at)',
    'SELECT 1');
PREPARE stmt_idx_task_quota FROM @ddl_idx_task_quota;
EXECUTE stmt_idx_task_quota;
DEALLOCATE PREPARE stmt_idx_task_quota;

-- ② adoption_code (bind_user_id, plot_id, status)
SET @idx_code_active_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'adoption_code'
      AND index_name = 'idx_code_bind_plot_status'
);
SET @ddl_idx_code_active := IF(@idx_code_active_exists = 0,
    'ALTER TABLE adoption_code ADD INDEX idx_code_bind_plot_status (bind_user_id, plot_id, status)',
    'SELECT 1');
PREPARE stmt_idx_code_active FROM @ddl_idx_code_active;
EXECUTE stmt_idx_code_active;
DEALLOCATE PREPARE stmt_idx_code_active;

-- ③ sensor_data (sensor_id, sensor_type, sample_at)
--    支撑“按 sensor_id + sensor_type 取最新读数”的批量查询
--    （ScreenServiceImpl / TaskDispatchServiceImpl 的执行前快照），
--    让 GROUP BY sensor_id,sensor_type 的 MAX(sample_at) 走松散索引扫描，
--    取代逐 sensor LIMIT 50 内存去重。
SET @idx_sensor_type_time_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'sensor_data'
      AND index_name = 'idx_sensor_type_latest'
);
SET @ddl_idx_sensor_type_time := IF(@idx_sensor_type_time_exists = 0,
    'ALTER TABLE sensor_data ADD INDEX idx_sensor_type_latest (sensor_id, sensor_type, sample_at)',
    'SELECT 1');
PREPARE stmt_idx_sensor_type_time FROM @ddl_idx_sensor_type_time;
EXECUTE stmt_idx_sensor_type_time;
DEALLOCATE PREPARE stmt_idx_sensor_type_time;
