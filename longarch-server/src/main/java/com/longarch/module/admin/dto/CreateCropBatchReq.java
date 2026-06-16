package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateCropBatchReq {

    @NotBlank(message = "作物名称不能为空")
    private String cropName;

    private String varietyName;

    private String growthStage;

    private String sowingAt;

    private String expectedHarvestAt;
}
