-- Add callback dedupe fields for MQTT callbacks.
-- callback_msg_id: device-provided unique id (preferred)
-- callback_dedupe_key: server-side dedupe key (used for uniqueness)

SET @col_msg_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'device_execution_log'
      AND column_name = 'callback_msg_id'
);

SET @ddl1 := IF(
    @col_msg_exists = 0,
    'ALTER TABLE device_execution_log ADD COLUMN callback_msg_id VARCHAR(64) NULL AFTER callback_payload',
    'SELECT 1'
);
PREPARE stmt1 FROM @ddl1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col_key_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'device_execution_log'
      AND column_name = 'callback_dedupe_key'
);

SET @ddl2 := IF(
    @col_key_exists = 0,
    'ALTER TABLE device_execution_log ADD COLUMN callback_dedupe_key VARCHAR(128) NULL AFTER callback_msg_id',
    'SELECT 1'
);
PREPARE stmt2 FROM @ddl2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Unique index on (task_id, callback_dedupe_key) to dedupe repeated callbacks per task.
SET @idx_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'device_execution_log'
      AND index_name = 'uk_task_callback_dedupe'
);

SET @ddl3 := IF(
    @idx_exists = 0,
    'ALTER TABLE device_execution_log ADD UNIQUE INDEX uk_task_callback_dedupe (task_id, callback_dedupe_key)',
    'SELECT 1'
);
PREPARE stmt3 FROM @ddl3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
