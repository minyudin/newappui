-- Operator ↔ Plot binding (责任域)
-- 用于 operator 执行人员负责哪些地块（多对多）

CREATE TABLE IF NOT EXISTS operator_plot_binding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    operator_user_id BIGINT NOT NULL,
    plot_id BIGINT NOT NULL,
    is_primary TINYINT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    valid_from DATETIME NULL,
    valid_to DATETIME NULL,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_plot_active (plot_id, status, deleted),
    KEY idx_operator_active (operator_user_id, status, deleted),
    UNIQUE KEY uniq_operator_plot_active (operator_user_id, plot_id, status, deleted)
);

