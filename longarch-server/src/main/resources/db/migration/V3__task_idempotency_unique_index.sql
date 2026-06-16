-- Ensure operation_task.idempotency_key has a unique index for hard idempotency guarantee.
SET @idx_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'operation_task'
      AND index_name = 'uk_idempotency_key'
);

SET @ddl := IF(
    @idx_exists = 0,
    'ALTER TABLE operation_task ADD UNIQUE INDEX uk_idempotency_key (idempotency_key)',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
