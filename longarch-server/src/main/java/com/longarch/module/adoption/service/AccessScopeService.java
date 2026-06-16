package com.longarch.module.adoption.service;

import com.longarch.common.result.PageResult;
import com.longarch.module.adoption.vo.AccessScopeVO;
import com.longarch.module.adoption.vo.AdoptionDetailVO;
import com.longarch.module.adoption.vo.AdoptionListVO;

public interface AccessScopeService {

    AccessScopeVO getAccessScope(Long plotId);

    PageResult<AdoptionListVO> getMyAdoptions(int pageNo, int pageSize, String status);

    AdoptionDetailVO getAdoptionDetail(Long orderId);

    /**
     * 功能级权限检查，guest 用户根据 adoption_code 字段控制
     * @param plotId 地块ID
     * @param feature 功能标识：can_operate / can_view_history / can_view_sensor
     */
    void checkFeatureAccess(Long plotId, String feature);
}
