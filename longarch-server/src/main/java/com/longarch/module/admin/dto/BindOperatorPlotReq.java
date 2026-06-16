package com.longarch.module.admin.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class BindOperatorPlotReq {

    /**
     * 1=主责, 0=备份
     */
    @Min(value = 0, message = "isPrimary最小为0")
    private Integer isPrimary = 0;
}

