package com.longarch.module.adoption.vo;

import lombok.Data;

@Data
public class RedeemCodeVO {

    private Boolean redeemed;
    private Long orderId;
    private Long plotId;
    private Long bindUserId;
}
