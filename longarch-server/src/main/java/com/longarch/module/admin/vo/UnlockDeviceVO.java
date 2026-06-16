package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class UnlockDeviceVO {

    private Long deviceId;
    private Boolean unlockSuccess;
    private Long previousLockTaskId;
    private String lockStatus;
    private String releasedAt;
    private Long operatorId;
}
