-- H2 兼容版建表脚本（测试用）

CREATE TABLE IF NOT EXISTS `user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_no` VARCHAR(32) NOT NULL,
    `open_id` VARCHAR(128) NOT NULL,
    `union_id` VARCHAR(128) DEFAULT NULL,
    `nickname` VARCHAR(64) DEFAULT NULL,
    `real_name` VARCHAR(64) DEFAULT NULL,
    `mobile` VARCHAR(20) DEFAULT NULL,
    `avatar_url` VARCHAR(512) DEFAULT NULL,
    `role_type` VARCHAR(32) NOT NULL DEFAULT 'adopter',
    `status` TINYINT NOT NULL DEFAULT 1,
    `bind_mobile` TINYINT NOT NULL DEFAULT 0,
    `password_hash` VARCHAR(100) DEFAULT NULL,
    `failed_count` INT NOT NULL DEFAULT 0,
    `locked_until` TIMESTAMP DEFAULT NULL,
    `last_login_at` TIMESTAMP DEFAULT NULL,
    `last_login_ip` VARCHAR(64) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_open_id` UNIQUE (`open_id`),
    CONSTRAINT `uk_user_no` UNIQUE (`user_no`)
);

CREATE TABLE IF NOT EXISTS `adoption_order` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(32) NOT NULL,
    `user_id` BIGINT DEFAULT NULL,
    `plot_id` BIGINT NOT NULL,
    `crop_batch_id` BIGINT DEFAULT NULL,
    `adoption_type` VARCHAR(32) DEFAULT 'plot_crop',
    `order_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `start_at` TIMESTAMP NOT NULL,
    `end_at` TIMESTAMP NOT NULL,
    `visibility_level` VARCHAR(32) DEFAULT 'full',
    `operation_level` VARCHAR(32) DEFAULT 'request_only',
    `payable_amount` DECIMAL(10, 2) DEFAULT NULL,
    `pay_status` VARCHAR(32) DEFAULT 'unpaid',
    `remark` VARCHAR(512) DEFAULT NULL,
    `created_by` BIGINT DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_order_no` UNIQUE (`order_no`)
);

CREATE TABLE IF NOT EXISTS `adoption_code` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `code_type` VARCHAR(32) NOT NULL DEFAULT 'master',
    `order_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `crop_batch_id` BIGINT DEFAULT NULL,
    `bind_user_id` BIGINT DEFAULT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `valid_from` TIMESTAMP NOT NULL,
    `valid_to` TIMESTAMP NOT NULL,
    `daily_access_start` TIME DEFAULT '08:00:00',
    `daily_access_end` TIME DEFAULT '22:00:00',
    `can_view_live` TINYINT NOT NULL DEFAULT 1,
    `can_view_history` TINYINT NOT NULL DEFAULT 1,
    `history_days` INT NOT NULL DEFAULT 7,
    `can_view_sensor` TINYINT NOT NULL DEFAULT 1,
    `can_operate` TINYINT NOT NULL DEFAULT 1,
    `operation_whitelist` VARCHAR(512) DEFAULT NULL,
    `max_daily_operations` INT NOT NULL DEFAULT 3,
    `shareable` TINYINT NOT NULL DEFAULT 0,
    `created_by_user_id` BIGINT DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_code` UNIQUE (`code`)
);

CREATE TABLE IF NOT EXISTS `plot` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `plot_no` VARCHAR(32) NOT NULL,
    `plot_name` VARCHAR(64) NOT NULL,
    `farm_id` BIGINT NOT NULL DEFAULT 1,
    `farm_name` VARCHAR(64) DEFAULT '陇上基地',
    `parent_id` BIGINT DEFAULT NULL,
    `area_size` DECIMAL(10, 2) DEFAULT NULL,
    `area_unit` VARCHAR(16) DEFAULT 'mu',
    `longitude` DECIMAL(12, 8) DEFAULT NULL,
    `latitude` DECIMAL(12, 8) DEFAULT NULL,
    `plot_status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `live_cover_url` VARCHAR(512) DEFAULT NULL,
    `intro_text` VARCHAR(512) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_plot_no` UNIQUE (`plot_no`)
);

CREATE TABLE IF NOT EXISTS `crop_batch` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_no` VARCHAR(32) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `crop_name` VARCHAR(64) NOT NULL,
    `variety_name` VARCHAR(64) DEFAULT NULL,
    `growth_stage` VARCHAR(32) DEFAULT NULL,
    `batch_status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `sowing_at` TIMESTAMP DEFAULT NULL,
    `expected_harvest_at` TIMESTAMP DEFAULT NULL,
    `next_task` VARCHAR(256) DEFAULT NULL,
    `risk_hint` VARCHAR(256) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_batch_no` UNIQUE (`batch_no`)
);

CREATE TABLE IF NOT EXISTS `camera_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `camera_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `stream_protocol` VARCHAR(32) DEFAULT 'rtmp',
    `playback_enabled` TINYINT NOT NULL DEFAULT 1,
    `ptz_enabled` TINYINT NOT NULL DEFAULT 0,
    `mic_enabled` TINYINT NOT NULL DEFAULT 0,
    `network_status` VARCHAR(32) DEFAULT 'offline',
    `device_status` VARCHAR(32) DEFAULT 'registered',
    `snapshot_url` VARCHAR(512) DEFAULT NULL,
    `rtmp_push_url` VARCHAR(512) DEFAULT NULL,
    `stream_app` VARCHAR(64) DEFAULT 'live',
    `stream_name` VARCHAR(64) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_cam_device_no` UNIQUE (`device_no`)
);

CREATE TABLE IF NOT EXISTS `sensor_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `sensor_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `sensor_type` VARCHAR(32) NOT NULL,
    `category` VARCHAR(32) NOT NULL DEFAULT 'soil',
    `unit` VARCHAR(16) DEFAULT NULL,
    `status` VARCHAR(32) DEFAULT 'online',
    `last_value` DECIMAL(10, 2) DEFAULT NULL,
    `last_sample_at` TIMESTAMP DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_sensor_device_no` UNIQUE (`device_no`)
);

CREATE TABLE IF NOT EXISTS `sensor_data` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sensor_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `sensor_type` VARCHAR(32) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `sample_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `actuator_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `device_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `device_type` VARCHAR(32) DEFAULT NULL,
    `device_status` VARCHAR(32) DEFAULT 'idle',
    `edge_node_no` VARCHAR(32) DEFAULT NULL,
    `network_status` VARCHAR(32) DEFAULT 'offline',
    `last_heartbeat_at` TIMESTAMP DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_act_device_no` UNIQUE (`device_no`)
);

CREATE TABLE IF NOT EXISTS `device_execution_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `device_no` VARCHAR(32) NOT NULL,
    `action_type` VARCHAR(32) NOT NULL,
    `command_payload` VARCHAR(4096),
    `callback_payload` VARCHAR(4096),
    `callback_msg_id` VARCHAR(64),
    `callback_dedupe_key` VARCHAR(128),
    `execution_status` VARCHAR(32) NOT NULL DEFAULT 'dispatched',
    `sensor_before` VARCHAR(2048),
    `sensor_after` VARCHAR(2048),
    `actual_duration_seconds` INT DEFAULT NULL,
    `dispatched_at` TIMESTAMP NOT NULL,
    `callback_at` TIMESTAMP DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `farming_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `plot_id` BIGINT NOT NULL,
    `crop_batch_id` BIGINT DEFAULT NULL,
    `record_type` VARCHAR(32) NOT NULL,
    `record_title` VARCHAR(128) NOT NULL,
    `operator_name` VARCHAR(64) DEFAULT NULL,
    `record_time` TIMESTAMP NOT NULL,
    `description` VARCHAR(512) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `operation_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_no` VARCHAR(32) NOT NULL,
    `request_user_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `action_type` VARCHAR(32) NOT NULL,
    `action_params` VARCHAR(2048) DEFAULT NULL,
    `scheduling_mode` VARCHAR(32) NOT NULL DEFAULT 'queue',
    `expected_execute_at` TIMESTAMP DEFAULT NULL,
    `idempotency_key` VARCHAR(128) NOT NULL,
    `priority` INT NOT NULL DEFAULT 10,
    `task_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `device_execution_state` VARCHAR(64) NOT NULL DEFAULT 'submitted',
    `queue_no` INT DEFAULT NULL,
    `estimated_wait_minutes` INT DEFAULT NULL,
    `fail_reason` VARCHAR(512) DEFAULT NULL,
    `cancelable` TINYINT NOT NULL DEFAULT 1,
    `queued_at` TIMESTAMP DEFAULT NULL,
    `started_at` TIMESTAMP DEFAULT NULL,
    `finished_at` TIMESTAMP DEFAULT NULL,
    `review_state` VARCHAR(32) NOT NULL DEFAULT 'none',
    `risk_level` VARCHAR(16) NOT NULL DEFAULT 'low',
    `risk_reasons` VARCHAR(1024) DEFAULT NULL,
    `assignee_user_id` BIGINT DEFAULT NULL,
    `assignment_mode` VARCHAR(16) DEFAULT NULL,
    `assigned_at` TIMESTAMP DEFAULT NULL,
    `assigned_by` BIGINT DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_task_no` UNIQUE (`task_no`),
    CONSTRAINT `uk_idempotency_key` UNIQUE (`idempotency_key`)
);

CREATE TABLE IF NOT EXISTS `operation_task_queue` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `priority` INT NOT NULL DEFAULT 10,
    `queued_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expire_at` TIMESTAMP DEFAULT NULL,
    `task_status` VARCHAR(32) NOT NULL DEFAULT 'queued',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `device_lock` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_id` BIGINT NOT NULL,
    `current_task_id` BIGINT DEFAULT NULL,
    `lock_owner` VARCHAR(64) DEFAULT NULL,
    `locked_at` TIMESTAMP DEFAULT NULL,
    `lock_expire_at` TIMESTAMP DEFAULT NULL,
    `lock_status` VARCHAR(32) NOT NULL DEFAULT 'free',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_device_id` UNIQUE (`device_id`)
);

CREATE TABLE IF NOT EXISTS `ai_analysis_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `plot_id` BIGINT NOT NULL,
    `analysis_type` VARCHAR(32) NOT NULL DEFAULT 'periodic',
    `sensor_snapshot` VARCHAR(4096) DEFAULT NULL,
    `crop_info` VARCHAR(512) DEFAULT NULL,
    `analysis_result` TEXT NOT NULL,
    `risk_level` VARCHAR(32) DEFAULT 'low',
    `suggested_actions` VARCHAR(4096) DEFAULT NULL,
    `review_result` VARCHAR(32) DEFAULT NULL,
    `review_comment` VARCHAR(512) DEFAULT NULL,
    `reviewed_by` BIGINT DEFAULT NULL,
    `reviewed_at` TIMESTAMP DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `edge_node` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `node_no` VARCHAR(32) NOT NULL,
    `farm_id` BIGINT NOT NULL DEFAULT 1,
    `node_name` VARCHAR(64) NOT NULL,
    `hardware_type` VARCHAR(64) DEFAULT NULL,
    `os_version` VARCHAR(64) DEFAULT NULL,
    `runtime_version` VARCHAR(64) DEFAULT NULL,
    `network_status` VARCHAR(32) DEFAULT 'online',
    `health_status` VARCHAR(32) DEFAULT 'healthy',
    `local_storage_free_mb` BIGINT DEFAULT NULL,
    `last_heartbeat_at` TIMESTAMP DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_node_no` UNIQUE (`node_no`)
);

CREATE TABLE IF NOT EXISTS `device_lifecycle_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_kind` VARCHAR(32) NOT NULL,
    `device_id` BIGINT NOT NULL,
    `device_no` VARCHAR(64) DEFAULT NULL,
    `plot_id` BIGINT DEFAULT NULL,
    `action` VARCHAR(32) NOT NULL,
    `reason` VARCHAR(512) DEFAULT NULL,
    `operator_id` BIGINT DEFAULT NULL,
    `before_json` VARCHAR(4096) DEFAULT NULL,
    `after_json` VARCHAR(4096) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `operator_plot_binding` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `operator_user_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `is_primary` TINYINT NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `valid_from` TIMESTAMP DEFAULT NULL,
    `valid_to` TIMESTAMP DEFAULT NULL,
    `created_by` BIGINT DEFAULT NULL,
    `updated_by` BIGINT DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uniq_operator_plot_active` UNIQUE (`operator_user_id`, `plot_id`, `status`, `deleted`)
);

CREATE TABLE IF NOT EXISTS `screen_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `screen_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `screen_token` VARCHAR(64) NOT NULL,
    `layout_config` TEXT DEFAULT NULL,
    `status` VARCHAR(32) DEFAULT 'offline',
    `last_ping_at` TIMESTAMP DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_screen_device_no` UNIQUE (`device_no`),
    CONSTRAINT `uk_screen_token` UNIQUE (`screen_token`)
);
