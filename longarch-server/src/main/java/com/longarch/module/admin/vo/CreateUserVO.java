package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class CreateUserVO {

    private Long userId;
    private String userNo;
    private String roleType;
    private Integer status;
}
