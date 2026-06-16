package com.longarch.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 管理员后台密码登录请求
 * ============================================================
 *  仅 roleType=admin 的用户可用
 *  失败 5 次锁定 15 分钟
 * ============================================================ */
@Data
public class AdminLoginReq {

    @NotBlank(message = "手机号必填")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式错误")
    private String mobile;

    @NotBlank(message = "密码必填")
    @Size(min = 6, max = 64, message = "密码长度 6-64")
    private String password;
}
