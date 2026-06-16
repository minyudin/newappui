-- Device lifecycle audit log (soft-delete / replace / unbind intent).
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备生命周期审计日志';
