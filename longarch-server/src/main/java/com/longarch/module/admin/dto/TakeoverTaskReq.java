package com.longarch.module.admin.dto;

import lombok.Data;

@Data
public class TakeoverTaskReq {

    private String reason;

    private Integer newPriority;
}
