package com.longarch.module.plot.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.entity.FarmingRecord;
import com.longarch.module.plot.entity.Plot;
import com.longarch.common.enums.ActionType;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.plot.mapper.FarmingRecordMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.plot.service.PlotService;
import com.longarch.module.plot.vo.CropBatchVO;
import com.longarch.module.plot.vo.FarmingRecordVO;
import com.longarch.module.plot.vo.PlotDetailVO;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.vo.TaskListVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlotServiceImpl implements PlotService {

    private final PlotMapper plotMapper;
    private final CropBatchMapper cropBatchMapper;
    private final FarmingRecordMapper farmingRecordMapper;
    private final OperationTaskMapper operationTaskMapper;
    private final AccessScopeService accessScopeService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public PlotDetailVO getPlotDetail(Long plotId) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_plot");
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在");
        }

        PlotDetailVO vo = new PlotDetailVO();
        vo.setPlotId(plot.getId());
        vo.setPlotNo(plot.getPlotNo());
        vo.setPlotName(plot.getPlotName());
        vo.setFarmId(plot.getFarmId());
        vo.setFarmName(plot.getFarmName());
        vo.setAreaSize(plot.getAreaSize());
        vo.setAreaUnit(plot.getAreaUnit());
        vo.setLongitude(plot.getLongitude());
        vo.setLatitude(plot.getLatitude());
        vo.setPlotStatus(plot.getPlotStatus());
        vo.setLiveCoverUrl(plot.getLiveCoverUrl());
        vo.setIntroText(plot.getIntroText());

        CropBatch batch = cropBatchMapper.selectOne(
                new LambdaQueryWrapper<CropBatch>()
                        .eq(CropBatch::getPlotId, plotId)
                        .eq(CropBatch::getBatchStatus, "active")
                        .last("LIMIT 1"));

        if (batch != null) {
            PlotDetailVO.CropBatchInfo info = new PlotDetailVO.CropBatchInfo();
            info.setCropBatchId(batch.getId());
            info.setBatchNo(batch.getBatchNo());
            info.setCropName(batch.getCropName());
            info.setVarietyName(batch.getVarietyName());
            info.setGrowthStage(batch.getGrowthStage());
            info.setSowingAt(batch.getSowingAt() != null ? batch.getSowingAt().format(FMT) : null);
            info.setExpectedHarvestAt(batch.getExpectedHarvestAt() != null ? batch.getExpectedHarvestAt().format(FMT) : null);
            vo.setCurrentCropBatch(info);
        }

        return vo;
    }

    @Override
    public CropBatchVO getCropBatch(Long plotId) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_plot");
        CropBatch batch = cropBatchMapper.selectOne(
                new LambdaQueryWrapper<CropBatch>()
                        .eq(CropBatch::getPlotId, plotId)
                        .eq(CropBatch::getBatchStatus, "active")
                        .last("LIMIT 1"));

        if (batch == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "当前无活跃作物批次");
        }

        CropBatchVO vo = new CropBatchVO();
        vo.setCropBatchId(batch.getId());
        vo.setBatchNo(batch.getBatchNo());
        vo.setCropName(batch.getCropName());
        vo.setVarietyName(batch.getVarietyName());
        vo.setGrowthStage(batch.getGrowthStage());
        vo.setBatchStatus(batch.getBatchStatus());
        vo.setSowingAt(batch.getSowingAt() != null ? batch.getSowingAt().format(FMT) : null);
        vo.setExpectedHarvestAt(batch.getExpectedHarvestAt() != null ? batch.getExpectedHarvestAt().format(FMT) : null);

        CropBatchVO.AgronomyPlan plan = new CropBatchVO.AgronomyPlan();
        plan.setNextTask(batch.getNextTask());
        plan.setRiskHint(batch.getRiskHint());
        vo.setAgronomyPlan(plan);

        return vo;
    }

    @Override
    public PageResult<FarmingRecordVO> getFarmingRecords(Long plotId, int pageNo, int pageSize) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_plot");
        Page<FarmingRecord> page = farmingRecordMapper.selectPage(
                new Page<>(pageNo, pageSize),
                new LambdaQueryWrapper<FarmingRecord>()
                        .eq(FarmingRecord::getPlotId, plotId)
                        .orderByDesc(FarmingRecord::getRecordTime));

        List<FarmingRecordVO> voList = page.getRecords().stream().map(r -> {
            FarmingRecordVO vo = new FarmingRecordVO();
            vo.setRecordId(r.getId());
            vo.setRecordType(r.getRecordType());
            vo.setRecordTitle(r.getRecordTitle());
            vo.setOperatorName(r.getOperatorName());
            vo.setRecordTime(r.getRecordTime() != null ? r.getRecordTime().format(FMT) : null);
            vo.setDescription(r.getDescription());
            return vo;
        }).collect(Collectors.toList());

        return PageResult.from(page, voList);
    }

    @Override
    public PageResult<TaskListVO> getOperationLogs(Long plotId, int pageNo, int pageSize) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_plot");
        Page<OperationTask> page = operationTaskMapper.selectPage(
                new Page<>(pageNo, pageSize),
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getPlotId, plotId)
                        .orderByDesc(OperationTask::getCreatedAt));

        Plot plot = plotMapper.selectById(plotId);

        List<TaskListVO> voList = page.getRecords().stream().map(t -> {
            TaskListVO vo = new TaskListVO();
            vo.setTaskId(t.getId());
            vo.setTaskNo(t.getTaskNo());
            vo.setPlotId(t.getPlotId());
            vo.setPlotName(plot != null ? plot.getPlotName() : null);
            vo.setActionType(t.getActionType());
            ActionType at = ActionType.fromValue(t.getActionType());
            vo.setActionName(at != null ? at.getLabel() : t.getActionType());
            vo.setTaskStatus(t.getTaskStatus());
            vo.setDeviceExecutionState(t.getDeviceExecutionState());
            vo.setQueueNo(t.getQueueNo());
            vo.setCreatedAt(t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : null);
            return vo;
        }).collect(Collectors.toList());

        return PageResult.from(page, voList);
    }
}
