package com.longarch.module.auth.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 昵称可用性预检 (POST /auth/check-nickname)
 *  · available=true · 合规且未被占用
 *  · available=false · reason 给出原因 (太短/字符不允许/已被占用 ...)
 *  · 用于前端输入框失焦/防抖即时反馈, 不消耗 NICKNAME_INVALID 错误码
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NicknameAvailabilityVO {

    private Boolean available;
    private String reason;
    /** 服务端规范化后的昵称 (trim/折叠空白后) · 供前端 echo 显示 */
    private String normalized;

    public static NicknameAvailabilityVO ok(String normalized) {
        return new NicknameAvailabilityVO(true, null, normalized);
    }

    public static NicknameAvailabilityVO fail(String normalized, String reason) {
        return new NicknameAvailabilityVO(false, reason, normalized);
    }
}
