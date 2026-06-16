-- V1: 陇上管家基础表结构

-- 1. 用户表
CREATE TABLE IF NOT EXISTS `user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_no` VARCHAR(32) NOT NULL COMMENT '用户编号',
    `open_id` VARCHAR(128) NOT NULL COMMENT '微信openId',
    `union_id` VARCHAR(128) DEFAULT NULL COMMENT '微信unionId',
    `nickname` VARCHAR(64) DEFAULT NULL,
    `real_name` VARCHAR(64) DEFAULT NULL,
    `mobile` VARCHAR(20) DEFAULT NULL,
    `avatar_url` VARCHAR(512) DEFAULT NULL,
    `role_type` VARCHAR(32) NOT NULL DEFAULT 'adopter',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常 0-禁用',
    `bind_mobile` TINYINT NOT NULL DEFAULT 0,
    `password_hash` VARCHAR(100) DEFAULT NULL,
    `failed_count` INT NOT NULL DEFAULT 0,
    `locked_until` DATETIME DEFAULT NULL,
    `last_login_at` DATETIME DEFAULT NULL,
    `last_login_ip` VARCHAR(64) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_open_id` (`open_id`),
    UNIQUE KEY `uk_user_no` (`user_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 认养订单表
CREATE TABLE IF NOT EXISTS `adoption_order` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(32) NOT NULL COMMENT '订单编号',
    `user_id` BIGINT DEFAULT NULL COMMENT '绑定用户',
    `plot_id` BIGINT NOT NULL,
    `crop_batch_id` BIGINT DEFAULT NULL,
    `adoption_type` VARCHAR(32) DEFAULT 'plot_crop',
    `order_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `start_at` DATETIME NOT NULL,
    `end_at` DATETIME NOT NULL,
    `visibility_level` VARCHAR(32) DEFAULT 'full',
    `operation_level` VARCHAR(32) DEFAULT 'request_only',
    `payable_amount` DECIMAL(10, 2) DEFAULT NULL COMMENT '应付金额',
    `pay_status` VARCHAR(32) DEFAULT 'unpaid' COMMENT 'unpaid/paid/refunded',
    `remark` VARCHAR(512) DEFAULT NULL COMMENT '备注',
    `created_by` BIGINT DEFAULT NULL COMMENT '创建人(管理员)ID',
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_no` (`order_no`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养订单表';

-- 3. 认养码表
CREATE TABLE IF NOT EXISTS `adoption_code` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL COMMENT '认养码',
    `code_type` VARCHAR(32) NOT NULL DEFAULT 'master' COMMENT 'master/guest/share',
    `order_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `crop_batch_id` BIGINT DEFAULT NULL,
    `bind_user_id` BIGINT DEFAULT NULL COMMENT '兑换绑定的用户',
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `valid_from` DATETIME NOT NULL,
    `valid_to` DATETIME NOT NULL,
    `daily_access_start` TIME DEFAULT '08:00:00',
    `daily_access_end` TIME DEFAULT '22:00:00',
    `can_view_live` TINYINT NOT NULL DEFAULT 1,
    `can_view_history` TINYINT NOT NULL DEFAULT 1,
    `history_days` INT NOT NULL DEFAULT 7,
    `can_view_sensor` TINYINT NOT NULL DEFAULT 1,
    `can_operate` TINYINT NOT NULL DEFAULT 1,
    `operation_whitelist` VARCHAR(512) DEFAULT NULL COMMENT 'JSON数组',
    `max_daily_operations` INT NOT NULL DEFAULT 3,
    `shareable` TINYINT NOT NULL DEFAULT 0,
    `created_by_user_id` BIGINT DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_code` (`code`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_bind_user_id` (`bind_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认养码表';

-- 4. 地块表
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
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_plot_no` (`plot_no`),
    KEY `idx_plot_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地块表';

-- 5. 作物批次表
CREATE TABLE IF NOT EXISTS `crop_batch` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_no` VARCHAR(32) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `crop_name` VARCHAR(64) NOT NULL,
    `variety_name` VARCHAR(64) DEFAULT NULL,
    `growth_stage` VARCHAR(32) DEFAULT NULL,
    `batch_status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `sowing_at` DATETIME DEFAULT NULL,
    `expected_harvest_at` DATETIME DEFAULT NULL,
    `next_task` VARCHAR(256) DEFAULT NULL,
    `risk_hint` VARCHAR(256) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_batch_no` (`batch_no`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='作物批次表';

-- 6. 摄像头设备表
CREATE TABLE IF NOT EXISTS `camera_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `camera_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `stream_protocol` VARCHAR(32) DEFAULT 'webrtc',
    `playback_enabled` TINYINT NOT NULL DEFAULT 1,
    `ptz_enabled` TINYINT NOT NULL DEFAULT 0,
    `mic_enabled` TINYINT NOT NULL DEFAULT 0,
    `network_status` VARCHAR(32) DEFAULT 'online',
    `device_status` VARCHAR(32) DEFAULT 'online',
    `snapshot_url` VARCHAR(512) DEFAULT NULL,
    `rtmp_push_url` VARCHAR(512) DEFAULT NULL,
    `stream_app` VARCHAR(64) DEFAULT 'live',
    `stream_name` VARCHAR(64) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_device_no` (`device_no`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='摄像头设备表';

-- 7. 传感器设备表
CREATE TABLE IF NOT EXISTS `sensor_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `sensor_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `sensor_type` VARCHAR(32) NOT NULL,
    `category` VARCHAR(32) NOT NULL DEFAULT 'soil' COMMENT 'environment/soil',
    `unit` VARCHAR(16) DEFAULT NULL,
    `status` VARCHAR(32) DEFAULT 'online',
    `last_value` DECIMAL(10, 2) DEFAULT NULL,
    `last_sample_at` DATETIME DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_device_no` (`device_no`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传感器设备表';

-- 8. 传感器数据表（时序）
CREATE TABLE IF NOT EXISTS `sensor_data` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sensor_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `sensor_type` VARCHAR(32) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `sample_at` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_sensor_time` (`sensor_id`, `sample_at`),
    KEY `idx_plot_type_time` (`plot_id`, `sensor_type`, `sample_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传感器采样数据表';

-- 9. 执行设备表
CREATE TABLE IF NOT EXISTS `actuator_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL,
    `device_name` VARCHAR(64) NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `device_type` VARCHAR(32) DEFAULT NULL COMMENT 'irrigator/fertilizer/sprayer',
    `device_status` VARCHAR(32) DEFAULT 'idle',
    `edge_node_no` VARCHAR(32) DEFAULT NULL,
    `network_status` VARCHAR(32) DEFAULT 'offline',
    `last_heartbeat_at` DATETIME DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_device_no` (`device_no`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行设备表';

-- 10. 农事记录表
CREATE TABLE IF NOT EXISTS `device_execution_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `device_no` VARCHAR(32) NOT NULL,
    `action_type` VARCHAR(32) NOT NULL,
    `command_payload` JSON DEFAULT NULL,
    `callback_payload` JSON DEFAULT NULL,
    `callback_msg_id` VARCHAR(64) DEFAULT NULL,
    `callback_dedupe_key` VARCHAR(128) DEFAULT NULL,
    `execution_status` VARCHAR(32) NOT NULL DEFAULT 'dispatched',
    `sensor_before` JSON DEFAULT NULL,
    `sensor_after` JSON DEFAULT NULL,
    `actual_duration_seconds` INT DEFAULT NULL,
    `dispatched_at` DATETIME NOT NULL,
    `callback_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_task_id` (`task_id`),
    KEY `idx_device_id` (`device_id`),
    KEY `idx_dispatched_at` (`dispatched_at`),
    UNIQUE KEY `uk_task_callback_dedupe` (`task_id`, `callback_dedupe_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='device execution log';

CREATE TABLE IF NOT EXISTS `farming_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `plot_id` BIGINT NOT NULL,
    `crop_batch_id` BIGINT DEFAULT NULL,
    `record_type` VARCHAR(32) NOT NULL,
    `record_title` VARCHAR(128) NOT NULL,
    `operator_name` VARCHAR(64) DEFAULT NULL,
    `record_time` DATETIME NOT NULL,
    `description` VARCHAR(512) DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农事记录表';

-- 11. 操作任务表
CREATE TABLE IF NOT EXISTS `operation_task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_no` VARCHAR(32) NOT NULL,
    `request_user_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `action_type` VARCHAR(32) NOT NULL,
    `action_params` JSON DEFAULT NULL,
    `scheduling_mode` VARCHAR(32) NOT NULL DEFAULT 'queue',
    `expected_execute_at` DATETIME DEFAULT NULL,
    `idempotency_key` VARCHAR(128) NOT NULL,
    `priority` INT NOT NULL DEFAULT 10,
    `task_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `device_execution_state` VARCHAR(64) NOT NULL DEFAULT 'submitted',
    `queue_no` INT DEFAULT NULL,
    `estimated_wait_minutes` INT DEFAULT NULL,
    `fail_reason` VARCHAR(512) DEFAULT NULL,
    `cancelable` TINYINT NOT NULL DEFAULT 1,
    `queued_at` DATETIME DEFAULT NULL,
    `started_at` DATETIME DEFAULT NULL,
    `finished_at` DATETIME DEFAULT NULL,
    `review_state` VARCHAR(32) NOT NULL DEFAULT 'none',
    `risk_level` VARCHAR(16) NOT NULL DEFAULT 'low',
    `risk_reasons` VARCHAR(1024) DEFAULT NULL,
    `assignee_user_id` BIGINT DEFAULT NULL,
    `assignment_mode` VARCHAR(16) DEFAULT NULL,
    `assigned_at` DATETIME DEFAULT NULL,
    `assigned_by` BIGINT DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_task_no` (`task_no`),
    UNIQUE KEY `uk_idempotency_key` (`idempotency_key`),
    KEY `idx_user_id` (`request_user_id`),
    KEY `idx_device_status` (`device_id`, `task_status`),
    KEY `idx_plot_status` (`plot_id`, `task_status`),
    KEY `idx_operation_task_review_state` (`review_state`, `created_at`),
    KEY `idx_operation_task_assignee` (`assignee_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作任务表';

-- 12. 任务队列表
CREATE TABLE IF NOT EXISTS `operation_task_queue` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_id` BIGINT NOT NULL,
    `device_id` BIGINT NOT NULL,
    `plot_id` BIGINT NOT NULL,
    `priority` INT NOT NULL DEFAULT 10,
    `queued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expire_at` DATETIME DEFAULT NULL,
    `task_status` VARCHAR(32) NOT NULL DEFAULT 'queued',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_device_priority` (`device_id`, `priority`, `queued_at`),
    KEY `idx_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务队列表';

-- 13. 设备锁表
CREATE TABLE IF NOT EXISTS `device_lock` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_id` BIGINT NOT NULL,
    `current_task_id` BIGINT DEFAULT NULL,
    `lock_owner` VARCHAR(64) DEFAULT NULL,
    `locked_at` DATETIME DEFAULT NULL,
    `lock_expire_at` DATETIME DEFAULT NULL,
    `lock_status` VARCHAR(32) NOT NULL DEFAULT 'free' COMMENT 'free/locked',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_device_id` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备锁表';

-- 14. AI分析记录表
CREATE TABLE IF NOT EXISTS `ai_analysis_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `plot_id` BIGINT NOT NULL,
    `analysis_type` VARCHAR(32) NOT NULL DEFAULT 'periodic' COMMENT 'periodic/manual/alert',
    `sensor_snapshot` JSON COMMENT '分析时的传感器数据快照',
    `crop_info` VARCHAR(512) COMMENT '作物信息摘要',
    `analysis_result` TEXT NOT NULL COMMENT 'AI分析结论',
    `risk_level` VARCHAR(32) DEFAULT 'low' COMMENT 'low/medium/high',
    `suggested_actions` JSON COMMENT '建议操作列表',
    `review_result` VARCHAR(32) DEFAULT NULL COMMENT 'approved/rejected/revised',
    `review_comment` VARCHAR(512) DEFAULT NULL,
    `reviewed_by` BIGINT DEFAULT NULL,
    `reviewed_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_plot_time` (`plot_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI分析记录表';

-- 15. 边缘节点表
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
    `last_heartbeat_at` DATETIME DEFAULT NULL,
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_node_no` (`node_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='边缘节点表';

-- 16. 大屏设备表
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

CREATE TABLE IF NOT EXISTS `screen_device` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `device_no` VARCHAR(32) NOT NULL COMMENT '大屏设备编号',
    `screen_name` VARCHAR(64) NOT NULL COMMENT '大屏名称',
    `plot_id` BIGINT NOT NULL COMMENT '绑定的地块',
    `screen_token` VARCHAR(64) NOT NULL COMMENT '大屏认证token',
    `layout_config` TEXT DEFAULT NULL COMMENT '布局配置JSON',
    `status` VARCHAR(32) DEFAULT 'offline' COMMENT 'online/offline',
    `last_ping_at` DATETIME DEFAULT NULL COMMENT '最后心跳时间',
    `deleted` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_screen_device_no` (`device_no`),
    UNIQUE KEY `uk_screen_token` (`screen_token`),
    KEY `idx_plot_id` (`plot_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大屏设备表';
