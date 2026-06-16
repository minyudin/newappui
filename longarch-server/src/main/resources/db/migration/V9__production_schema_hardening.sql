-- Fill schema drift for databases created before Flyway was introduced.

CREATE TABLE IF NOT EXISTS `device_execution_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `device_no` VARCHAR(32) NOT NULL,
    `action_type` VARCHAR(32) NOT NULL,
    `command_payload` JSON NULL,
    `callback_payload` JSON NULL,
    `callback_msg_id` VARCHAR(64) NULL,
    `callback_dedupe_key` VARCHAR(128) NULL,
    `execution_status` VARCHAR(32) NOT NULL DEFAULT 'dispatched',
    `sensor_before` JSON NULL,
    `sensor_after` JSON NULL,
    `actual_duration_seconds` INT DEFAULT NULL,
    `dispatched_at` DATETIME NOT NULL,
    `callback_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_device_id` (`device_id`),
    KEY `idx_dispatched_at` (`dispatched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='device execution log';

CREATE TABLE IF NOT EXISTS `device_lifecycle_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_kind` VARCHAR(32) NOT NULL COMMENT 'actuator/sensor/camera/screen',
    `device_id` BIGINT NOT NULL,
    `device_no` VARCHAR(64) DEFAULT NULL,
    `plot_id` BIGINT DEFAULT NULL,
    `action` VARCHAR(32) NOT NULL COMMENT 'retire/replace/bind',
    `reason` VARCHAR(512) DEFAULT NULL,
    `operator_id` BIGINT DEFAULT NULL,
    `before_json` JSON DEFAULT NULL,
    `after_json` JSON DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_device` (`device_kind`, `device_id`),
    KEY `idx_plot` (`plot_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='device lifecycle audit log';

CREATE TABLE IF NOT EXISTS `operator_plot_binding` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `operator_user_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `is_primary` TINYINT NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `valid_from` DATETIME NULL,
    `valid_to` DATETIME NULL,
    `created_by` BIGINT NULL,
    `updated_by` BIGINT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_plot_active` (`plot_id`, `status`, `deleted`),
    KEY `idx_operator_active` (`operator_user_id`, `status`, `deleted`),
    UNIQUE KEY `uniq_operator_plot_active` (`operator_user_id`, `plot_id`, `status`, `deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='operator plot binding';

SET @col_user_password_hash_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'password_hash'
);
SET @ddl_user_password_hash := IF(@col_user_password_hash_exists = 0,
    'ALTER TABLE `user` ADD COLUMN password_hash VARCHAR(100) NULL AFTER bind_mobile',
    'SELECT 1');
PREPARE stmt_user_password_hash FROM @ddl_user_password_hash;
EXECUTE stmt_user_password_hash;
DEALLOCATE PREPARE stmt_user_password_hash;

SET @col_user_failed_count_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'failed_count'
);
SET @ddl_user_failed_count := IF(@col_user_failed_count_exists = 0,
    'ALTER TABLE `user` ADD COLUMN failed_count INT NOT NULL DEFAULT 0 AFTER password_hash',
    'SELECT 1');
PREPARE stmt_user_failed_count FROM @ddl_user_failed_count;
EXECUTE stmt_user_failed_count;
DEALLOCATE PREPARE stmt_user_failed_count;

SET @col_user_locked_until_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'locked_until'
);
SET @ddl_user_locked_until := IF(@col_user_locked_until_exists = 0,
    'ALTER TABLE `user` ADD COLUMN locked_until DATETIME NULL AFTER failed_count',
    'SELECT 1');
PREPARE stmt_user_locked_until FROM @ddl_user_locked_until;
EXECUTE stmt_user_locked_until;
DEALLOCATE PREPARE stmt_user_locked_until;

SET @col_user_last_login_at_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'last_login_at'
);
SET @ddl_user_last_login_at := IF(@col_user_last_login_at_exists = 0,
    'ALTER TABLE `user` ADD COLUMN last_login_at DATETIME NULL AFTER locked_until',
    'SELECT 1');
PREPARE stmt_user_last_login_at FROM @ddl_user_last_login_at;
EXECUTE stmt_user_last_login_at;
DEALLOCATE PREPARE stmt_user_last_login_at;

SET @col_user_last_login_ip_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'last_login_ip'
);
SET @ddl_user_last_login_ip := IF(@col_user_last_login_ip_exists = 0,
    'ALTER TABLE `user` ADD COLUMN last_login_ip VARCHAR(64) NULL AFTER last_login_at',
    'SELECT 1');
PREPARE stmt_user_last_login_ip FROM @ddl_user_last_login_ip;
EXECUTE stmt_user_last_login_ip;
DEALLOCATE PREPARE stmt_user_last_login_ip;

SET @col_adoption_code_created_by_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'adoption_code' AND column_name = 'created_by_user_id'
);
SET @ddl_adoption_code_created_by := IF(@col_adoption_code_created_by_exists = 0,
    'ALTER TABLE adoption_code ADD COLUMN created_by_user_id BIGINT NULL AFTER shareable',
    'SELECT 1');
PREPARE stmt_adoption_code_created_by FROM @ddl_adoption_code_created_by;
EXECUTE stmt_adoption_code_created_by;
DEALLOCATE PREPARE stmt_adoption_code_created_by;

SET @col_plot_parent_id_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'plot' AND column_name = 'parent_id'
);
SET @ddl_plot_parent_id := IF(@col_plot_parent_id_exists = 0,
    'ALTER TABLE plot ADD COLUMN parent_id BIGINT NULL AFTER farm_name',
    'SELECT 1');
PREPARE stmt_plot_parent_id FROM @ddl_plot_parent_id;
EXECUTE stmt_plot_parent_id;
DEALLOCATE PREPARE stmt_plot_parent_id;

SET @idx_plot_parent_id_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'plot' AND index_name = 'idx_plot_parent_id'
);
SET @ddl_idx_plot_parent_id := IF(@idx_plot_parent_id_exists = 0,
    'ALTER TABLE plot ADD INDEX idx_plot_parent_id (parent_id)',
    'SELECT 1');
PREPARE stmt_idx_plot_parent_id FROM @ddl_idx_plot_parent_id;
EXECUTE stmt_idx_plot_parent_id;
DEALLOCATE PREPARE stmt_idx_plot_parent_id;

SET @col_camera_rtmp_push_url_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'camera_device' AND column_name = 'rtmp_push_url'
);
SET @ddl_camera_rtmp_push_url := IF(@col_camera_rtmp_push_url_exists = 0,
    'ALTER TABLE camera_device ADD COLUMN rtmp_push_url VARCHAR(512) NULL AFTER snapshot_url',
    'SELECT 1');
PREPARE stmt_camera_rtmp_push_url FROM @ddl_camera_rtmp_push_url;
EXECUTE stmt_camera_rtmp_push_url;
DEALLOCATE PREPARE stmt_camera_rtmp_push_url;

SET @col_camera_stream_app_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'camera_device' AND column_name = 'stream_app'
);
SET @ddl_camera_stream_app := IF(@col_camera_stream_app_exists = 0,
    'ALTER TABLE camera_device ADD COLUMN stream_app VARCHAR(64) DEFAULT ''live'' AFTER rtmp_push_url',
    'SELECT 1');
PREPARE stmt_camera_stream_app FROM @ddl_camera_stream_app;
EXECUTE stmt_camera_stream_app;
DEALLOCATE PREPARE stmt_camera_stream_app;

SET @col_camera_stream_name_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'camera_device' AND column_name = 'stream_name'
);
SET @ddl_camera_stream_name := IF(@col_camera_stream_name_exists = 0,
    'ALTER TABLE camera_device ADD COLUMN stream_name VARCHAR(64) NULL AFTER stream_app',
    'SELECT 1');
PREPARE stmt_camera_stream_name FROM @ddl_camera_stream_name;
EXECUTE stmt_camera_stream_name;
DEALLOCATE PREPARE stmt_camera_stream_name;

UPDATE camera_device SET stream_app = 'live' WHERE stream_app IS NULL;

SET @col_actuator_network_status_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'actuator_device' AND column_name = 'network_status'
);
SET @ddl_actuator_network_status := IF(@col_actuator_network_status_exists = 0,
    'ALTER TABLE actuator_device ADD COLUMN network_status VARCHAR(32) DEFAULT ''offline'' AFTER edge_node_no',
    'SELECT 1');
PREPARE stmt_actuator_network_status FROM @ddl_actuator_network_status;
EXECUTE stmt_actuator_network_status;
DEALLOCATE PREPARE stmt_actuator_network_status;

SET @col_actuator_last_heartbeat_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'actuator_device' AND column_name = 'last_heartbeat_at'
);
SET @ddl_actuator_last_heartbeat := IF(@col_actuator_last_heartbeat_exists = 0,
    'ALTER TABLE actuator_device ADD COLUMN last_heartbeat_at DATETIME NULL AFTER network_status',
    'SELECT 1');
PREPARE stmt_actuator_last_heartbeat FROM @ddl_actuator_last_heartbeat;
EXECUTE stmt_actuator_last_heartbeat;
DEALLOCATE PREPARE stmt_actuator_last_heartbeat;

SET @col_ai_review_result_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'ai_analysis_record' AND column_name = 'review_result'
);
SET @ddl_ai_review_result := IF(@col_ai_review_result_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN review_result VARCHAR(32) NULL AFTER suggested_actions',
    'SELECT 1');
PREPARE stmt_ai_review_result FROM @ddl_ai_review_result;
EXECUTE stmt_ai_review_result;
DEALLOCATE PREPARE stmt_ai_review_result;

SET @col_ai_review_comment_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'ai_analysis_record' AND column_name = 'review_comment'
);
SET @ddl_ai_review_comment := IF(@col_ai_review_comment_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN review_comment VARCHAR(512) NULL AFTER review_result',
    'SELECT 1');
PREPARE stmt_ai_review_comment FROM @ddl_ai_review_comment;
EXECUTE stmt_ai_review_comment;
DEALLOCATE PREPARE stmt_ai_review_comment;

SET @col_ai_reviewed_by_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'ai_analysis_record' AND column_name = 'reviewed_by'
);
SET @ddl_ai_reviewed_by := IF(@col_ai_reviewed_by_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN reviewed_by BIGINT NULL AFTER review_comment',
    'SELECT 1');
PREPARE stmt_ai_reviewed_by FROM @ddl_ai_reviewed_by;
EXECUTE stmt_ai_reviewed_by;
DEALLOCATE PREPARE stmt_ai_reviewed_by;

SET @col_ai_reviewed_at_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'ai_analysis_record' AND column_name = 'reviewed_at'
);
SET @ddl_ai_reviewed_at := IF(@col_ai_reviewed_at_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by',
    'SELECT 1');
PREPARE stmt_ai_reviewed_at FROM @ddl_ai_reviewed_at;
EXECUTE stmt_ai_reviewed_at;
DEALLOCATE PREPARE stmt_ai_reviewed_at;

SET @idx_task_idempotency_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND index_name = 'uk_idempotency_key'
);
SET @ddl_idx_task_idempotency := IF(@idx_task_idempotency_exists = 0,
    'ALTER TABLE operation_task ADD UNIQUE INDEX uk_idempotency_key (idempotency_key)',
    'SELECT 1');
PREPARE stmt_idx_task_idempotency FROM @ddl_idx_task_idempotency;
EXECUTE stmt_idx_task_idempotency;
DEALLOCATE PREPARE stmt_idx_task_idempotency;

SET @col_task_review_state_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'review_state'
);
SET @ddl_task_review_state := IF(@col_task_review_state_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN review_state VARCHAR(32) NOT NULL DEFAULT ''none'' AFTER finished_at',
    'SELECT 1');
PREPARE stmt_task_review_state FROM @ddl_task_review_state;
EXECUTE stmt_task_review_state;
DEALLOCATE PREPARE stmt_task_review_state;

SET @col_task_risk_level_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'risk_level'
);
SET @ddl_task_risk_level := IF(@col_task_risk_level_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN risk_level VARCHAR(16) NOT NULL DEFAULT ''low'' AFTER review_state',
    'SELECT 1');
PREPARE stmt_task_risk_level FROM @ddl_task_risk_level;
EXECUTE stmt_task_risk_level;
DEALLOCATE PREPARE stmt_task_risk_level;

SET @col_task_risk_reasons_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'risk_reasons'
);
SET @ddl_task_risk_reasons := IF(@col_task_risk_reasons_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN risk_reasons VARCHAR(1024) NULL AFTER risk_level',
    'SELECT 1');
PREPARE stmt_task_risk_reasons FROM @ddl_task_risk_reasons;
EXECUTE stmt_task_risk_reasons;
DEALLOCATE PREPARE stmt_task_risk_reasons;

SET @col_task_assignee_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'assignee_user_id'
);
SET @ddl_task_assignee := IF(@col_task_assignee_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assignee_user_id BIGINT NULL AFTER risk_reasons',
    'SELECT 1');
PREPARE stmt_task_assignee FROM @ddl_task_assignee;
EXECUTE stmt_task_assignee;
DEALLOCATE PREPARE stmt_task_assignee;

SET @col_task_assignment_mode_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'assignment_mode'
);
SET @ddl_task_assignment_mode := IF(@col_task_assignment_mode_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assignment_mode VARCHAR(16) NULL AFTER assignee_user_id',
    'SELECT 1');
PREPARE stmt_task_assignment_mode FROM @ddl_task_assignment_mode;
EXECUTE stmt_task_assignment_mode;
DEALLOCATE PREPARE stmt_task_assignment_mode;

SET @col_task_assigned_at_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'assigned_at'
);
SET @ddl_task_assigned_at := IF(@col_task_assigned_at_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assigned_at DATETIME NULL AFTER assignment_mode',
    'SELECT 1');
PREPARE stmt_task_assigned_at FROM @ddl_task_assigned_at;
EXECUTE stmt_task_assigned_at;
DEALLOCATE PREPARE stmt_task_assigned_at;

SET @col_task_assigned_by_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND column_name = 'assigned_by'
);
SET @ddl_task_assigned_by := IF(@col_task_assigned_by_exists = 0,
    'ALTER TABLE operation_task ADD COLUMN assigned_by BIGINT NULL AFTER assigned_at',
    'SELECT 1');
PREPARE stmt_task_assigned_by FROM @ddl_task_assigned_by;
EXECUTE stmt_task_assigned_by;
DEALLOCATE PREPARE stmt_task_assigned_by;

SET @idx_task_review_state_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND index_name = 'idx_operation_task_review_state'
);
SET @ddl_idx_task_review_state := IF(@idx_task_review_state_exists = 0,
    'ALTER TABLE operation_task ADD INDEX idx_operation_task_review_state (review_state, created_at)',
    'SELECT 1');
PREPARE stmt_idx_task_review_state FROM @ddl_idx_task_review_state;
EXECUTE stmt_idx_task_review_state;
DEALLOCATE PREPARE stmt_idx_task_review_state;

SET @idx_task_assignee_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'operation_task' AND index_name = 'idx_operation_task_assignee'
);
SET @ddl_idx_task_assignee := IF(@idx_task_assignee_exists = 0,
    'ALTER TABLE operation_task ADD INDEX idx_operation_task_assignee (assignee_user_id, created_at)',
    'SELECT 1');
PREPARE stmt_idx_task_assignee FROM @ddl_idx_task_assignee;
EXECUTE stmt_idx_task_assignee;
DEALLOCATE PREPARE stmt_idx_task_assignee;

SET @idx_exec_task_id_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'device_execution_log' AND index_name = 'idx_task_id'
);
SET @ddl_idx_exec_task_id := IF(@idx_exec_task_id_exists = 0,
    'ALTER TABLE device_execution_log ADD INDEX idx_task_id (task_id)',
    'SELECT 1');
PREPARE stmt_idx_exec_task_id FROM @ddl_idx_exec_task_id;
EXECUTE stmt_idx_exec_task_id;
DEALLOCATE PREPARE stmt_idx_exec_task_id;

SET @idx_exec_device_id_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'device_execution_log' AND index_name = 'idx_device_id'
);
SET @ddl_idx_exec_device_id := IF(@idx_exec_device_id_exists = 0,
    'ALTER TABLE device_execution_log ADD INDEX idx_device_id (device_id)',
    'SELECT 1');
PREPARE stmt_idx_exec_device_id FROM @ddl_idx_exec_device_id;
EXECUTE stmt_idx_exec_device_id;
DEALLOCATE PREPARE stmt_idx_exec_device_id;

SET @idx_exec_dispatched_at_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'device_execution_log' AND index_name = 'idx_dispatched_at'
);
SET @ddl_idx_exec_dispatched_at := IF(@idx_exec_dispatched_at_exists = 0,
    'ALTER TABLE device_execution_log ADD INDEX idx_dispatched_at (dispatched_at)',
    'SELECT 1');
PREPARE stmt_idx_exec_dispatched_at FROM @ddl_idx_exec_dispatched_at;
EXECUTE stmt_idx_exec_dispatched_at;
DEALLOCATE PREPARE stmt_idx_exec_dispatched_at;

SET @col_exec_callback_msg_id_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'device_execution_log' AND column_name = 'callback_msg_id'
);
SET @ddl_exec_callback_msg_id := IF(@col_exec_callback_msg_id_exists = 0,
    'ALTER TABLE device_execution_log ADD COLUMN callback_msg_id VARCHAR(64) NULL AFTER callback_payload',
    'SELECT 1');
PREPARE stmt_exec_callback_msg_id FROM @ddl_exec_callback_msg_id;
EXECUTE stmt_exec_callback_msg_id;
DEALLOCATE PREPARE stmt_exec_callback_msg_id;

SET @col_exec_callback_dedupe_exists := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'device_execution_log' AND column_name = 'callback_dedupe_key'
);
SET @ddl_exec_callback_dedupe := IF(@col_exec_callback_dedupe_exists = 0,
    'ALTER TABLE device_execution_log ADD COLUMN callback_dedupe_key VARCHAR(128) NULL AFTER callback_msg_id',
    'SELECT 1');
PREPARE stmt_exec_callback_dedupe FROM @ddl_exec_callback_dedupe;
EXECUTE stmt_exec_callback_dedupe;
DEALLOCATE PREPARE stmt_exec_callback_dedupe;

SET @idx_exec_callback_dedupe_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'device_execution_log' AND index_name = 'uk_task_callback_dedupe'
);
SET @ddl_idx_exec_callback_dedupe := IF(@idx_exec_callback_dedupe_exists = 0,
    'ALTER TABLE device_execution_log ADD UNIQUE INDEX uk_task_callback_dedupe (task_id, callback_dedupe_key)',
    'SELECT 1');
PREPARE stmt_idx_exec_callback_dedupe FROM @ddl_idx_exec_callback_dedupe;
EXECUTE stmt_idx_exec_callback_dedupe;
DEALLOCATE PREPARE stmt_idx_exec_callback_dedupe;
