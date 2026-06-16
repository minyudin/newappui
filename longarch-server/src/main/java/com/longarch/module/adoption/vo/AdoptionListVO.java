package com.longarch.module.adoption.vo;

import lombok.Data;

@Data
public class AdoptionListVO {

    private Long orderId;
    private String orderNo;
    private Long plotId;
    private String plotName;
    private Long cropBatchId;
    private String cropName;
    private String varietyName;
    private String growthStage;
    private String coverUrl;
    private String startAt;
    private String endAt;
    private String orderStatus;
}
