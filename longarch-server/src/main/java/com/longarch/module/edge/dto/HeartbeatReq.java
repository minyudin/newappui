package com.longarch.module.edge.dto;

import lombok.Data;

@Data
public class HeartbeatReq {

    private String networkStatus;
    private String healthStatus;
    private Long localStorageFreeMb;
    private String timestamp;
}
