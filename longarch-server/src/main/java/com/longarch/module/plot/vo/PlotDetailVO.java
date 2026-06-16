package com.longarch.module.plot.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlotDetailVO {

    private Long plotId;
    private String plotNo;
    private String plotName;
    private Long farmId;
    private String farmName;
    private BigDecimal areaSize;
    private String areaUnit;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String plotStatus;
    private String liveCoverUrl;
    private String introText;
    private CropBatchInfo currentCropBatch;

    @Data
    public static class CropBatchInfo {
        private Long cropBatchId;
        private String batchNo;
        private String cropName;
        private String varietyName;
        private String growthStage;
        private String sowingAt;
        private String expectedHarvestAt;
    }
}
