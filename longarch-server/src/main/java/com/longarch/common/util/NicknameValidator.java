package com.longarch.common.util;

import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * 昵称合规规则 · 前后端共享 (后端为最终防线, 前端只做体验)
 * ============================================================
 *  方案 A · 强制注册补昵称:
 *   · 长度  2 ~ 16 (按 Unicode codepoint 计, 一个汉字算 1)
 *   · 字符集 \p{L} \p{N} 下划线 空格 (允许中英数 + 下划线 + 单空格)
 *   · 全部 trim, 中间多个空白折叠成单个
 *   · 拒绝 "用户XXXXXX" / "游客XXXXXX" 自动昵称样式 (防仿冒系统默认)
 *   · 拒绝平台保留词
 *
 *  唯一性 (重名校验) 不在这里做, 由 Service 层先 SELECT, 兜底 DB 唯一索引.
 * ============================================================ */
public final class NicknameValidator {

    private NicknameValidator() {}

    /** Unicode 字母 / 数字 / 下划线 / 空格 · {2,16} */
    private static final Pattern PATTERN = Pattern.compile("^[\\p{L}\\p{N}_ ]{2,16}$");

    /** 系统自动昵称样式 · "用户312501" / "游客488123" · 防仿冒 */
    private static final Pattern AUTO_PATTERN = Pattern.compile("^(用户|游客)\\d{4,8}$");

    /** 平台保留词 · 全部小写比较 */
    private static final Set<String> RESERVED = Set.of(
            "admin", "administrator", "root", "system",
            "管理员", "客服", "系统", "陇上管家", "longarch"
    );

    /**
     * 规范化昵称: trim 首尾 + 折叠多空白成单空格.
     * 不做 lowercase, 数据库唯一索引由 utf8mb4_unicode_ci 处理大小写.
     */
    public static String normalize(String raw) {
        if (raw == null) return null;
        return raw.trim().replaceAll("\\s+", " ");
    }

    /**
     * 校验合规, 不通过抛 BizException(NICKNAME_INVALID, "中文原因").
     * 调用前应先调 normalize() 拿规范化后的值.
     */
    public static void validate(String normalized) {
        if (normalized == null || normalized.isEmpty()) {
            throw new BizException(ErrorCode.NICKNAME_INVALID, "昵称不能为空");
        }

        // codepoint 长度 (避免代理对让长度计数错位)
        int cpCount = normalized.codePointCount(0, normalized.length());
        if (cpCount < 2) {
            throw new BizException(ErrorCode.NICKNAME_INVALID, "昵称至少 2 个字符");
        }
        if (cpCount > 16) {
            throw new BizException(ErrorCode.NICKNAME_INVALID, "昵称不能超过 16 个字符");
        }

        if (!PATTERN.matcher(normalized).matches()) {
            throw new BizException(ErrorCode.NICKNAME_INVALID,
                    "昵称仅支持中英文/数字/下划线/空格");
        }

        if (AUTO_PATTERN.matcher(normalized).matches()) {
            throw new BizException(ErrorCode.NICKNAME_INVALID,
                    "请勿使用系统默认昵称格式, 例如 用户123456");
        }

        if (RESERVED.contains(normalized.toLowerCase())) {
            throw new BizException(ErrorCode.NICKNAME_INVALID,
                    "该昵称被系统保留, 请换一个");
        }
    }
}
