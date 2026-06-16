-- ============================================================
-- V10 · user.nickname 全平台唯一 · 强制注册补昵称
-- ============================================================
--  方案 A · 预建号 + 待激活:
--    · wechatLogin INSERT 时 nickname=NULL
--    · 用户必须调 /auth/setup-nickname 提交真实昵称才能进业务
--    · MySQL 唯一索引允许多行 NULL → 待激活用户不会互撞,
--      已激活的 nickname 全平台唯一
--
--  本迁移做三件事:
--   ① 把旧的"用户XXXXXX"自动生成昵称统一置 NULL ·
--      让这些 dev/演示用户下次登录被强制补昵称
--   ② 把 nickname 列从 VARCHAR(64) 收紧到 VARCHAR(32) (匹配前端 16 字符上限的 utf8mb4 字节边界)
--   ③ 新增 UNIQUE INDEX uk_nickname (nickname)
--
--  注意: deleted=1 的软删用户也参与唯一索引判定 ·
--    因为我们用 TableLogic 软删, 不希望"删了一个昵称又被新人占走" 的体验
--    若将来要复用旧昵称, 走 admin 硬删 + 复用 流程
-- ============================================================

-- ① 把旧"用户XXXXXX" 自动生成昵称置空 (匹配 stub 模式遗留的 user_no 末 6 位格式)
--    例: '用户312501', '游客488123' 都置 NULL · 用户/游客字面量 + 6 位数字
UPDATE `user`
SET `nickname` = NULL
WHERE `nickname` REGEXP '^(用户|游客)[0-9]{4,8}$';

-- ② 收紧字段长度
SET @col_len_ok := (
    SELECT COUNT(1) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user'
      AND column_name = 'nickname'
      AND character_maximum_length = 32
);
SET @ddl_modify := IF(@col_len_ok = 0,
    'ALTER TABLE `user` MODIFY COLUMN `nickname` VARCHAR(32) NULL COMMENT ''用户昵称, 非 null 时全平台唯一''',
    'SELECT 1');
PREPARE stmt_modify FROM @ddl_modify;
EXECUTE stmt_modify;
DEALLOCATE PREPARE stmt_modify;

-- ③ 加唯一索引 · 已存在则跳过 (幂等)
SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user'
      AND index_name = 'uk_nickname'
);
SET @ddl_idx := IF(@idx_exists = 0,
    'ALTER TABLE `user` ADD UNIQUE INDEX uk_nickname (nickname)',
    'SELECT 1');
PREPARE stmt_idx FROM @ddl_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
