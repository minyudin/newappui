package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class UserListVO {
    private Long userId;
    private String userNo;
    private String openId;
    private String nickname;
    private String realName;
    private String mobile;
    private String roleType;
    private Integer status;
    private Integer bindMobile;
    private String createdAt;
}
