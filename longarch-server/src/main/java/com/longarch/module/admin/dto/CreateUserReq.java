package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateUserReq {

    @NotBlank(message = "openId不能为空")
    private String openId;

    private String nickname;

    private String realName;

    private String mobile;

    @NotBlank(message = "角色类型不能为空")
    private String roleType;
}
