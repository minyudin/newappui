package com.longarch.module.auth.config;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.BCrypt;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * AdminUserSeeder
 * ============================================================
 *  目的: 在应用启动时幂等地
 *    1) 给 user 表补齐密码登录所需字段 (首次运行)
 *    2) 补齐一条默认 admin 记录 (mobile + bcrypt password_hash)
 *
 *  触发条件: longarch.admin.seed.enabled = true (默认 false, dev 显式开启)
 *
 *  幂等性:
 *   - 列存在则不重复 ALTER
 *   - 若 mobile 已存在且 password_hash 已设置 → 跳过
 *   - 若 mobile 已存在但 password_hash 为 null → UPDATE 设置密码 (追加 admin 登录能力)
 *   - 若 mobile 不存在 → INSERT 新 admin 行
 * ============================================================ */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminUserSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Value("${longarch.admin.seed.enabled:false}")
    private boolean enabled;

    @Value("${longarch.admin.seed.mobile:15675201507}")
    private String seedMobile;

    @Value("${longarch.admin.seed.password:admin123456}")
    private String seedPassword;

    @Value("${longarch.admin.seed.nickname:平台管理员}")
    private String seedNickname;

    @Override
    public void run(org.springframework.boot.ApplicationArguments args) {
        if (!enabled) {
            log.info("AdminUserSeeder skipped (enabled=false)");
            return;
        }
        if (seedPassword == null || seedPassword.isBlank()) {
            log.warn("AdminUserSeeder skipped because longarch.admin.seed.password is blank");
            return;
        }

        try {
            // ---- Step 1: 幂等加列 ----
            ensureColumn("password_hash", "VARCHAR(100) NULL COMMENT '管理员后台密码 BCrypt'");
            ensureColumn("failed_count",  "INT NOT NULL DEFAULT 0 COMMENT '连续登录失败次数'");
            ensureColumn("locked_until",  "DATETIME NULL COMMENT '锁定至'");
            ensureColumn("last_login_at", "DATETIME NULL COMMENT '最近登录时间'");
            ensureColumn("last_login_ip", "VARCHAR(64) NULL COMMENT '最近登录 IP'");

            // ---- Step 2: 幂等播种 admin ----
            ensureAdmin();
        } catch (Exception e) {
            log.error("AdminUserSeeder failed: {}", e.getMessage(), e);
            // 种子失败不影响启动, 但打印告警
        }
    }

    private void ensureColumn(String colName, String colDef) {
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                        "WHERE TABLE_SCHEMA = DATABASE() " +
                        "  AND TABLE_NAME = 'user' " +
                        "  AND COLUMN_NAME = ?",
                Integer.class, colName);
        if (exists == null || exists == 0) {
            jdbc.execute("ALTER TABLE `user` ADD COLUMN `" + colName + "` " + colDef);
            log.info("AdminUserSeeder: added column user.{}", colName);
        }
    }

    private void ensureAdmin() {
        Integer existsCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM `user` WHERE mobile = ? AND deleted = 0",
                Integer.class, seedMobile);

        if (existsCount != null && existsCount > 0) {
            // 存在: 若 password_hash 为 null 则补一次; 否则保留用户自己改过的密码
            Integer nullPwd = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM `user` WHERE mobile = ? AND deleted = 0 " +
                            "  AND (password_hash IS NULL OR password_hash = '')",
                    Integer.class, seedMobile);
            if (nullPwd != null && nullPwd > 0) {
                String hash = BCrypt.hashpw(seedPassword, BCrypt.gensalt(10));
                int updated = jdbc.update(
                        "UPDATE `user` SET password_hash = ?, role_type = 'admin', status = 1 " +
                                "WHERE mobile = ? AND deleted = 0",
                        hash, seedMobile);
                log.info("AdminUserSeeder: existing mobile={} upgraded to admin with password ({} rows)",
                        seedMobile, updated);
            } else {
                log.info("AdminUserSeeder: admin mobile={} already seeded, skip", seedMobile);
            }
            return;
        }

        // 不存在: INSERT
        String hash = BCrypt.hashpw(seedPassword, BCrypt.gensalt(10));
        String userNo = "U" + IdUtil.getSnowflakeNextIdStr();
        String openId = "admin_mobile_" + seedMobile;

        jdbc.update(
                "INSERT INTO `user` (user_no, open_id, nickname, mobile, role_type, status, bind_mobile, " +
                        "  password_hash, failed_count) " +
                        "VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, 0)",
                userNo, openId, seedNickname, seedMobile, hash);

        log.info("AdminUserSeeder: seeded admin userNo={} mobile={} (password hidden)",
                userNo, seedMobile);
    }
}
