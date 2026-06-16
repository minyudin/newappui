package com.longarch.module.edge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EdgeRegisterReq {

    @NotBlank(message = "节点编号不能为空")
    private String nodeNo;

    @NotNull(message = "农场ID不能为空")
    private Long farmId;

    @NotBlank(message = "节点名称不能为空")
    private String nodeName;

    private String hardwareType;
    private String osVersion;
    private String runtimeVersion;
}
