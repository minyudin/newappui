-- Add AI analysis review fields for environments created before review columns existed.

SET @col_review_result_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_analysis_record'
      AND column_name = 'review_result'
);

SET @ddl1 := IF(
    @col_review_result_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN review_result VARCHAR(32) NULL COMMENT ''approved/rejected/revised'' AFTER suggested_actions',
    'SELECT 1'
);
PREPARE stmt1 FROM @ddl1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col_review_comment_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_analysis_record'
      AND column_name = 'review_comment'
);

SET @ddl2 := IF(
    @col_review_comment_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN review_comment VARCHAR(512) NULL AFTER review_result',
    'SELECT 1'
);
PREPARE stmt2 FROM @ddl2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @col_reviewed_by_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_analysis_record'
      AND column_name = 'reviewed_by'
);

SET @ddl3 := IF(
    @col_reviewed_by_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN reviewed_by BIGINT NULL AFTER review_comment',
    'SELECT 1'
);
PREPARE stmt3 FROM @ddl3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

SET @col_reviewed_at_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_analysis_record'
      AND column_name = 'reviewed_at'
);

SET @ddl4 := IF(
    @col_reviewed_at_exists = 0,
    'ALTER TABLE ai_analysis_record ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by',
    'SELECT 1'
);
PREPARE stmt4 FROM @ddl4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;
