# V10 回滚 · user.nickname 唯一索引

> Flyway Community 不支持 `down` migrate · 本文档供运维手工回滚

## 影响范围
- `user.nickname` 列长度从 `VARCHAR(64)` 收紧为 `VARCHAR(32)`
- 新增 `UNIQUE INDEX uk_nickname (nickname)`
- 旧"用户XXXXXX"/"游客XXXXXX"格式昵称已被批量置 NULL

## 何时需要回滚
- 唯一索引导致旧业务大量并发写失败,且短期无法修代码
- VARCHAR(32) 不够用 (例如发现历史数据有 33+ 字符的合法昵称未被预清洗)

## 回滚 SQL (按顺序执行)

```sql
-- ① 卸掉唯一索引
ALTER TABLE `user` DROP INDEX uk_nickname;

-- ② 放宽字段长度
ALTER TABLE `user` MODIFY COLUMN `nickname` VARCHAR(64) NULL;

-- ③ 从 flyway_schema_history 移除 V10 记录, 让下次 baseline 不再校验
DELETE FROM flyway_schema_history WHERE version = '10';
```

## 重要提醒
- **被置 NULL 的旧昵称无法自动恢复**,因为我们没有备份 NULL 之前的值
- 如需保留旧"用户XXXXXX"昵称,**回滚前必须先 dump 一份**:
  ```bash
  mysqldump -u root -p longarch user --where="nickname IS NULL" --skip-extended-insert > user_null_backup.sql
  ```
- 回滚后,前端 UserInfoVO.bindNickname 仍会按"是否非空 nickname"判断;
  字段不存在风险 — 接口仍会返回 false 触发补昵称流程,**业务依然可用**
- 不要尝试重新执行 V10:Flyway 会因 checksum 冲突报错;
  必须 `DELETE FROM flyway_schema_history WHERE version = '10'` 后才能让 V10 重新被识别

## 验证回滚
```sql
SHOW INDEX FROM `user` WHERE Key_name = 'uk_nickname';  -- 应返 0 行
SHOW COLUMNS FROM `user` LIKE 'nickname';               -- type 应是 VARCHAR(64)
SELECT version FROM flyway_schema_history WHERE version = '10';  -- 应返 0 行
```
