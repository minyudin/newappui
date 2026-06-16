package com.longarch.module.plot.controller;

import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.module.plot.service.PlotService;
import com.longarch.module.plot.vo.CropBatchVO;
import com.longarch.module.plot.vo.FarmingRecordVO;
import com.longarch.module.plot.vo.PlotDetailVO;
import com.longarch.module.task.vo.TaskListVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "地块与作物")
@RestController
@RequestMapping("/api/v1/plots")
@RequiredArgsConstructor
public class PlotController {

    private final PlotService plotService;

    @Operation(summary = "API-09 获取地块详情")
    @GetMapping("/{plotId}")
    public R<PlotDetailVO> plotDetail(@PathVariable Long plotId) {
        return R.ok(plotService.getPlotDetail(plotId));
    }

    @Operation(summary = "API-10 获取作物批次详情")
    @GetMapping("/{plotId}/crop-batch")
    public R<CropBatchVO> cropBatch(@PathVariable Long plotId) {
        return R.ok(plotService.getCropBatch(plotId));
    }

    @Operation(summary = "API-11 获取地块农事记录")
    @GetMapping("/{plotId}/farming-records")
    public R<PageResult<FarmingRecordVO>> farmingRecords(
            @PathVariable Long plotId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize) {
        return R.ok(plotService.getFarmingRecords(plotId, pageNo, pageSize));
    }

    @Operation(summary = "API-12 获取地块操作记录")
    @GetMapping("/{plotId}/operation-logs")
    public R<PageResult<TaskListVO>> operationLogs(
            @PathVariable Long plotId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize) {
        return R.ok(plotService.getOperationLogs(plotId, pageNo, pageSize));
    }
}
