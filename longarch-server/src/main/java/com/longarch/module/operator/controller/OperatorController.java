package com.longarch.module.operator.controller;

import cn.dev33.satoken.annotation.SaCheckRole;
import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.module.operator.dto.CreateFarmingRecordReq;
import com.longarch.module.operator.dto.UpdateCropBatchReq;
import com.longarch.module.operator.service.OperatorService;
import com.longarch.module.operator.vo.CropBatchDetailVO;
import com.longarch.module.operator.vo.FarmTaskListVO;
import com.longarch.module.operator.vo.FarmingRecordDetailVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "运营人员")
@SaCheckRole("operator")
@RestController
@RequestMapping("/api/v1/operator")
@RequiredArgsConstructor
public class OperatorController {

    private final OperatorService operatorService;

    @Operation(summary = "录入农事记录")
    @PostMapping("/farming-records")
    public R<FarmingRecordDetailVO> createFarmingRecord(@Valid @RequestBody CreateFarmingRecordReq req) {
        return R.ok(operatorService.createFarmingRecord(req));
    }

    @Operation(summary = "查询地块农事记录列表")
    @GetMapping("/plots/{plotId}/farming-records")
    public R<PageResult<FarmingRecordDetailVO>> getFarmingRecords(
            @PathVariable Long plotId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize) {
        return R.ok(operatorService.getFarmingRecords(plotId, pageNo, pageSize));
    }

    @Operation(summary = "更新作物批次信息")
    @PutMapping("/crop-batches/{cropBatchId}")
    public R<CropBatchDetailVO> updateCropBatch(
            @PathVariable Long cropBatchId,
            @Valid @RequestBody UpdateCropBatchReq req) {
        return R.ok(operatorService.updateCropBatch(cropBatchId, req));
    }

    @Operation(summary = "查询作物批次详情")
    @GetMapping("/crop-batches/{cropBatchId}")
    public R<CropBatchDetailVO> getCropBatchDetail(@PathVariable Long cropBatchId) {
        return R.ok(operatorService.getCropBatchDetail(cropBatchId));
    }

    @Operation(summary = "查询农场级任务列表")
    @GetMapping("/farms/{farmId}/tasks")
    public R<PageResult<FarmTaskListVO>> getFarmTasks(
            @PathVariable Long farmId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String taskStatus) {
        return R.ok(operatorService.getFarmTasks(farmId, pageNo, pageSize, taskStatus));
    }
}
