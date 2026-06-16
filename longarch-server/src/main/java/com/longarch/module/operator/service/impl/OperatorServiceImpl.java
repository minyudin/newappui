package com.longarch.module.operator.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.auth.entity.User;
import com.longarch.module.auth.mapper.UserMapper;
import com.longarch.module.operator.dto.CreateFarmingRecordReq;
import com.longarch.module.operator.dto.UpdateCropBatchReq;
import com.longarch.module.operator.service.OperatorService;
import com.longarch.module.operator.vo.CropBatchDetailVO;
import com.longarch.module.operator.vo.FarmTaskListVO;
import com.longarch.module.operator.vo.FarmingRecordDetailVO;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.entity.FarmingRecord;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.plot.mapper.FarmingRecordMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.OperationTaskMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperatorServiceImpl implements OperatorService {

    private final FarmingRecordMapper farmingRecordMapper;
    private final CropBatchMapper cropBatchMapper;
    private final PlotMapper plotMapper;
    private final OperationTaskMapper taskMapper;
    private final UserMapper userMapper;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    @Transactional
    public FarmingRecordDetailVO createFarmingRecord(CreateFarmingRecordReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        User user = userMapper.selectById(userId);

        // 校验地块存在
        Plot plot = plotMapper.selectById(req.getPlotId());
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + req.getPlotId());
        }

        FarmingRecord record = new FarmingRecord();
        record.setPlotId(req.getPlotId());
        record.setCropBatchId(req.getCropBatchId());
        record.setRecordType(req.getRecordType());
        record.setRecordTitle(req.getRecordTitle());
        record.setOperatorName(user != null && user.getRealName() != null ? user.getRealName() : "运营人员");
        record.setRecordTime(req.getRecordTime() != null ? LocalDateTime.parse(req.getRecordTime(), FMT) : LocalDateTime.now());
        record.setDescription(req.getDescription());
        farmingRecordMapper.insert(record);

        log.info("Operator created farming record: recordId={}, plotId={}, by={}", record.getId(), req.getPlotId(), userId);

        return buildFarmingRecordVO(record);
    }

    @Override
    @Transactional
    public CropBatchDetailVO updateCropBatch(Long cropBatchId, UpdateCropBatchReq req) {
        CropBatch batch = cropBatchMapper.selectById(cropBatchId);
        if (batch == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "作物批次不存在");
        }

        if (req.getGrowthStage() != null) batch.setGrowthStage(req.getGrowthStage());
        if (req.getBatchStatus() != null) batch.setBatchStatus(req.getBatchStatus());
        if (req.getNextTask() != null) batch.setNextTask(req.getNextTask());
        if (req.getRiskHint() != null) batch.setRiskHint(req.getRiskHint());
        if (req.getExpectedHarvestAt() != null) batch.setExpectedHarvestAt(LocalDateTime.parse(req.getExpectedHarvestAt(), FMT));
        cropBatchMapper.updateById(batch);

        log.info("Operator updated crop batch: batchId={}, by={}", cropBatchId, StpUtil.getLoginIdAsLong());

        return buildCropBatchVO(batch);
    }

    @Override
    public CropBatchDetailVO getCropBatchDetail(Long cropBatchId) {
        CropBatch batch = cropBatchMapper.selectById(cropBatchId);
        if (batch == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "作物批次不存在");
        }
        return buildCropBatchVO(batch);
    }

    @Override
    public PageResult<FarmingRecordDetailVO> getFarmingRecords(Long plotId, int pageNo, int pageSize) {
        Page<FarmingRecord> page = farmingRecordMapper.selectPage(
                new Page<>(pageNo, pageSize),
                new LambdaQueryWrapper<FarmingRecord>()
                        .eq(FarmingRecord::getPlotId, plotId)
                        .orderByDesc(FarmingRecord::getRecordTime));

        List<FarmingRecordDetailVO> list = page.getRecords().stream()
                .map(this::buildFarmingRecordVO)
                .collect(Collectors.toList());

        return PageResult.of(list, pageNo, pageSize, page.getTotal());
    }

    @Override
    public PageResult<FarmTaskListVO> getFarmTasks(Long farmId, int pageNo, int pageSize, String taskStatus) {
        // 先查该 farm 下的所有地块
        List<Plot> plots = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>().eq(Plot::getFarmId, farmId));
        if (plots.isEmpty()) {
            return PageResult.of(List.of(), pageNo, pageSize, 0);
        }

        List<Long> plotIds = plots.stream().map(Plot::getId).collect(Collectors.toList());
        Map<Long, String> plotNameMap = plots.stream().collect(Collectors.toMap(Plot::getId, Plot::getPlotName));

        LambdaQueryWrapper<OperationTask> wrapper = new LambdaQueryWrapper<OperationTask>()
                .in(OperationTask::getPlotId, plotIds)
                .orderByDesc(OperationTask::getCreatedAt);
        if (taskStatus != null && !taskStatus.isBlank()) {
            wrapper.eq(OperationTask::getTaskStatus, taskStatus);
        }

        Page<OperationTask> page = taskMapper.selectPage(new Page<>(pageNo, pageSize), wrapper);

        List<FarmTaskListVO> list = page.getRecords().stream().map(task -> {
            FarmTaskListVO vo = new FarmTaskListVO();
            vo.setTaskId(task.getId());
            vo.setTaskNo(task.getTaskNo());
            vo.setPlotId(task.getPlotId());
            vo.setPlotName(plotNameMap.getOrDefault(task.getPlotId(), ""));
            vo.setUserId(task.getRequestUserId());
            vo.setActionType(task.getActionType());
            vo.setTaskStatus(task.getTaskStatus());
            vo.setPriority(task.getPriority());
            vo.setCreatedAt(task.getCreatedAt() != null ? task.getCreatedAt().format(FMT) : null);
            vo.setExecutedAt(task.getFinishedAt() != null ? task.getFinishedAt().format(FMT) : null);
            return vo;
        }).collect(Collectors.toList());

        return PageResult.of(list, pageNo, pageSize, page.getTotal());
    }

    private FarmingRecordDetailVO buildFarmingRecordVO(FarmingRecord record) {
        FarmingRecordDetailVO vo = new FarmingRecordDetailVO();
        vo.setRecordId(record.getId());
        vo.setPlotId(record.getPlotId());
        vo.setCropBatchId(record.getCropBatchId());
        vo.setRecordType(record.getRecordType());
        vo.setRecordTitle(record.getRecordTitle());
        vo.setOperatorName(record.getOperatorName());
        vo.setRecordTime(record.getRecordTime() != null ? record.getRecordTime().format(FMT) : null);
        vo.setDescription(record.getDescription());
        vo.setCreatedAt(record.getCreatedAt() != null ? record.getCreatedAt().format(FMT) : null);
        return vo;
    }

    private CropBatchDetailVO buildCropBatchVO(CropBatch batch) {
        CropBatchDetailVO vo = new CropBatchDetailVO();
        vo.setCropBatchId(batch.getId());
        vo.setBatchNo(batch.getBatchNo());
        vo.setPlotId(batch.getPlotId());
        vo.setCropName(batch.getCropName());
        vo.setVarietyName(batch.getVarietyName());
        vo.setGrowthStage(batch.getGrowthStage());
        vo.setBatchStatus(batch.getBatchStatus());
        vo.setSowingAt(batch.getSowingAt() != null ? batch.getSowingAt().format(FMT) : null);
        vo.setExpectedHarvestAt(batch.getExpectedHarvestAt() != null ? batch.getExpectedHarvestAt().format(FMT) : null);
        vo.setNextTask(batch.getNextTask());
        vo.setRiskHint(batch.getRiskHint());
        vo.setUpdatedAt(batch.getUpdatedAt() != null ? batch.getUpdatedAt().format(FMT) : null);
        return vo;
    }
}
