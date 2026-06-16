package com.longarch.module.operator.service;

import com.longarch.common.result.PageResult;
import com.longarch.module.operator.dto.CreateFarmingRecordReq;
import com.longarch.module.operator.dto.UpdateCropBatchReq;
import com.longarch.module.operator.vo.CropBatchDetailVO;
import com.longarch.module.operator.vo.FarmTaskListVO;
import com.longarch.module.operator.vo.FarmingRecordDetailVO;

public interface OperatorService {

    FarmingRecordDetailVO createFarmingRecord(CreateFarmingRecordReq req);

    CropBatchDetailVO updateCropBatch(Long cropBatchId, UpdateCropBatchReq req);

    CropBatchDetailVO getCropBatchDetail(Long cropBatchId);

    PageResult<FarmingRecordDetailVO> getFarmingRecords(Long plotId, int pageNo, int pageSize);

    PageResult<FarmTaskListVO> getFarmTasks(Long farmId, int pageNo, int pageSize, String taskStatus);
}
