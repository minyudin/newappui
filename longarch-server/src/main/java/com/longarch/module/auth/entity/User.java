package com.longarch.module.auth.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String userNo;
    private String openId;
    private String unionId;
    private String nickname;
    private String realName;
    private String mobile;
    private String avatarUrl;
    private String roleType;
    private Integer status;
    private Integer bindMobile;

    // ==== 管理员后台密码登录相关字段 (仅 roleType=admin 使用) ====
    /** BCrypt 密码哈希 (非 admin 用户为 null) */
    private String passwordHash;
    /** 连续登录失败次数 */
    private Integer failedCount;
    /** 锁定至某时刻 (null = 未锁定) */
    private LocalDateTime lockedUntil;
    /** 最近一次登录时间 */
    private LocalDateTime lastLoginAt;
    /** 最近一次登录 IP */
    private String lastLoginIp;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
