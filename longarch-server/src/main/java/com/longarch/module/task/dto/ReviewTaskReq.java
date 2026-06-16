package com.longarch.module.task.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewTaskReq {

    /**
     * approve | reject
     */
    @NotBlank(message = "decision不能为空")
    private String decision;

    /**
     * 可选：拒绝原因/人工确认备注
     */
    private String reason;
}

