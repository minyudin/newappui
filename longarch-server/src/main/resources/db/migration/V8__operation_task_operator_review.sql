-- Operation task: operator review/claim fields for high-risk flow.

SET @col_review_state_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'review_state'
);
SET @ddl_review_state := IF(
    @col_review_state_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN review_state VARCHAR(32) NOT NULL DEFAULT ''none'' AFTER finished_at',
    'SELECT 1'
);
PREPARE stmt_review_state FROM @ddl_review_state;
EXECUTE stmt_review_state;
DEALLOCATE PREPARE stmt_review_state;

SET @col_risk_level_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'risk_level'
);
SET @ddl_risk_level := IF(
    @col_risk_level_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN risk_level VARCHAR(16) NOT NULL DEFAULT ''low'' AFTER review_state',
    'SELECT 1'
);
PREPARE stmt_risk_level FROM @ddl_risk_level;
EXECUTE stmt_risk_level;
DEALLOCATE PREPARE stmt_risk_level;

SET @col_risk_reasons_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'risk_reasons'
);
SET @ddl_risk_reasons := IF(
    @col_risk_reasons_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN risk_reasons VARCHAR(1024) NULL AFTER risk_level',
    'SELECT 1'
);
PREPARE stmt_risk_reasons FROM @ddl_risk_reasons;
EXECUTE stmt_risk_reasons;
DEALLOCATE PREPARE stmt_risk_reasons;

SET @col_assignee_user_id_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'assignee_user_id'
);
SET @ddl_assignee_user_id := IF(
    @col_assignee_user_id_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assignee_user_id BIGINT NULL AFTER risk_reasons',
    'SELECT 1'
);
PREPARE stmt_assignee_user_id FROM @ddl_assignee_user_id;
EXECUTE stmt_assignee_user_id;
DEALLOCATE PREPARE stmt_assignee_user_id;

SET @col_assignment_mode_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'assignment_mode'
);
SET @ddl_assignment_mode := IF(
    @col_assignment_mode_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assignment_mode VARCHAR(16) NULL AFTER assignee_user_id',
    'SELECT 1'
);
PREPARE stmt_assignment_mode FROM @ddl_assignment_mode;
EXECUTE stmt_assignment_mode;
DEALLOCATE PREPARE stmt_assignment_mode;

SET @col_assigned_at_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'assigned_at'
);
SET @ddl_assigned_at := IF(
    @col_assigned_at_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assigned_at DATETIME NULL AFTER assignment_mode',
    'SELECT 1'
);
PREPARE stmt_assigned_at FROM @ddl_assigned_at;
EXECUTE stmt_assigned_at;
DEALLOCATE PREPARE stmt_assigned_at;

SET @col_assigned_by_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND column_name = 'assigned_by'
);
SET @ddl_assigned_by := IF(
    @col_assigned_by_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assigned_by BIGINT NULL AFTER assigned_at',
    'SELECT 1'
);
PREPARE stmt_assigned_by FROM @ddl_assigned_by;
EXECUTE stmt_assigned_by;
DEALLOCATE PREPARE stmt_assigned_by;

SET @idx_review_state_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND index_name = 'idx_operation_task_review_state'
);
SET @ddl_idx_review_state := IF(
    @idx_review_state_exists = 0,
    'ALTER TABLE operation_task ADD INDEX idx_operation_task_review_state (review_state, created_at)',
    'SELECT 1'
);
PREPARE stmt_idx_review_state FROM @ddl_idx_review_state;
EXECUTE stmt_idx_review_state;
DEALLOCATE PREPARE stmt_idx_review_state;

SET @idx_assignee_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND index_name = 'idx_operation_task_assignee'
);
SET @ddl_idx_assignee := IF(
    @idx_assignee_exists = 0,
    'ALTER TABLE operation_task ADD INDEX idx_operation_task_assignee (assignee_user_id, created_at)',
    'SELECT 1'
);
PREPARE stmt_idx_assignee FROM @ddl_idx_assignee;
EXECUTE stmt_idx_assignee;
DEALLOCATE PREPARE stmt_idx_assignee;
