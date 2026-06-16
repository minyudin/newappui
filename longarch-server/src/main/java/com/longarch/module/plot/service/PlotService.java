package com.longarch.module.plot.service;

import com.longarch.common.result.PageResult;
import com.longarch.module.plot.vo.CropBatchVO;
import com.longarch.module.plot.vo.FarmingRecordVO;
import com.longarch.module.plot.vo.PlotDetailVO;
import com.longarch.module.task.vo.TaskListVO;

public interface PlotService {

    PlotDetailVO getPlotDetail(Long plotId);

    CropBatchVO getCropBatch(Long plotId);

    PageResult<FarmingRecordVO> getFarmingRecords(Long plotId, int pageNo, int pageSize);

    PageResult<TaskListVO> getOperationLogs(Long plotId, int pageNo, int pageSize);
}
