package com.longarch.module.agronomist.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.agronomist.dto.CreateHighPriorityTaskReq;
import com.longarch.module.agronomist.dto.ReviewAiAnalysisReq;
import com.longarch.module.agronomist.service.AgronomistService;
import com.longarch.module.agronomist.vo.AiAnalysisReviewVO;
import com.longarch.module.agronomist.vo.CrossPlotSummaryVO;
import com.longarch.module.agronomist.vo.RiskAlertVO;
import com.longarch.module.ai.entity.AiAnalysisRecord;
import com.longarch.module.ai.mapper.AiAnalysisRecordMapper;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.service.SchedulerService;
import com.longarch.module.task.vo.CreateTaskVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgronomistServiceImpl implements AgronomistService {

    private final PlotMapper plotMapper;
    private final CropBatchMapper cropBatchMapper;
    private final AiAnalysisRecordMapper analysisRecordMapper;
    private final OperationTaskMapper taskMapper;
    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final SchedulerService schedulerService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public List<RiskAlertVO> getRiskAlerts(Long farmId) {
        List<Plot> plots = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>().eq(Plot::getFarmId, farmId));
        if (plots.isEmpty()) {
            return List.of();
        }

        List<Long> plotIds = plots.stream().map(Plot::getId).collect(Collectors.toList());
        Map<Long, String> plotNameMap = plots.stream().collect(Collectors.toMap(Plot::getId, Plot::getPlotName));

        List<CropBatch> batches = cropBatchMapper.selectList(
                new LambdaQueryWrapper<CropBatch>()
                        .in(CropBatch::getPlotId, plotIds)
                        .isNotNull(CropBatch::getRiskHint)
                        .ne(CropBatch::getRiskHint, ""));

        return batches.stream().map(batch -> {
            RiskAlertVO vo = new RiskAlertVO();
            vo.setPlotId(batch.getPlotId());
            vo.setPlotName(plotNameMap.getOrDefault(batch.getPlotId(), ""));
            vo.setCropBatchId(batch.getId());
            vo.setCropName(batch.getCropName());
            vo.setGrowthStage(batch.getGrowthStage());
            vo.setRiskHint(batch.getRiskHint());
            vo.setBatchStatus(batch.getBatchStatus());
            vo.setUpdatedAt(batch.getUpdatedAt() != null ? batch.getUpdatedAt().format(FMT) : null);
            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    public CrossPlotSummaryVO getCrossPlotSummary(Long farmId) {
        List<Plot> plots = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>().eq(Plot::getFarmId, farmId));

        CrossPlotSummaryVO summary = new CrossPlotSummaryVO();
        summary.setFarmId(farmId);
        summary.setFarmName(plots.isEmpty() ? "" : plots.get(0).getFarmName());
        summary.setTotalPlots(plots.size());

        List<Long> plotIds = plots.stream().map(Plot::getId).collect(Collectors.toList());
        Map<Long, String> plotNameMap = plots.stream().collect(Collectors.toMap(Plot::getId, Plot::getPlotName));

        List<CropBatch> batches = plotIds.isEmpty() ? List.of() : cropBatchMapper.selectList(
                new LambdaQueryWrapper<CropBatch>()
                        .in(CropBatch::getPlotId, plotIds)
                        .eq(CropBatch::getBatchStatus, "active"));

        int riskCount = 0;
        List<CrossPlotSummaryVO.PlotSummary> plotSummaries = new ArrayList<>();
        for (CropBatch batch : batches) {
            CrossPlotSummaryVO.PlotSummary ps = new CrossPlotSummaryVO.PlotSummary();
            ps.setPlotId(batch.getPlotId());
            ps.setPlotName(plotNameMap.getOrDefault(batch.getPlotId(), ""));
            ps.setCropName(batch.getCropName());
            ps.setGrowthStage(batch.getGrowthStage());
            ps.setRiskHint(batch.getRiskHint());
            ps.setBatchStatus(batch.getBatchStatus());
            plotSummaries.add(ps);
            if (batch.getRiskHint() != null && !batch.getRiskHint().isBlank()) {
                riskCount++;
            }
        }
        summary.setRiskPlots(riskCount);
        summary.setPlots(plotSummaries);
        return summary;
    }

    @Override
    @Transactional
    public CreateTaskVO createHighPriorityTask(CreateHighPriorityTaskReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        int priority = (req.getPriority() != null) ? req.getPriority() : 2;

        // 校验地块存在
        Plot plot = plotMapper.selectById(req.getPlotId());
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + req.getPlotId());
        }

        // 校验设备存在
        ActuatorDevice device = actuatorDeviceMapper.selectById(req.getDeviceId());
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "设备不存在: deviceId=" + req.getDeviceId());
        }

        OperationTask task = new OperationTask();
        task.setTaskNo("T" + IdUtil.getSnowflakeNextIdStr());
        task.setRequestUserId(userId);
        task.setPlotId(req.getPlotId());
        task.setDeviceId(req.getDeviceId());
        task.setActionType(req.getActionType());
        task.setActionParams(req.getActionParams());
        task.setSchedulingMode("queue");
        task.setIdempotencyKey("agro_" + userId + "_" + req.getPlotId() + "_" + req.getActionType() + "_" + System.currentTimeMillis());
        task.setPriority(priority);
        task.setTaskStatus("pending");
        task.setDeviceExecutionState("submitted");
        task.setCancelable(1);
        taskMapper.insert(task);

        // 走正常调度流程：锁空闲→直接派发，锁占用→入队
        schedulerService.schedule(task);

        // 调度会通过条件更新落库，需回查最新状态再返回
        OperationTask latest = taskMapper.selectById(task.getId());
        if (latest != null) {
            task = latest;
        }

        log.info("Agronomist created high-priority task: taskId={}, priority={}, reason={}, by={}",
                task.getId(), priority, req.getReason(), userId);

        CreateTaskVO vo = new CreateTaskVO();
        vo.setTaskId(task.getId());
        vo.setTaskNo(task.getTaskNo());
        vo.setTaskStatus(task.getTaskStatus());
        vo.setDeviceExecutionState(task.getDeviceExecutionState());
        vo.setQueueNo(task.getQueueNo());
        vo.setEstimatedWaitMinutes(task.getEstimatedWaitMinutes());
        vo.setMessage("农技人员创建高优先级任务，优先级=" + priority);
        return vo;
    }

    @Override
    @Transactional
    public AiAnalysisReviewVO reviewAiAnalysis(ReviewAiAnalysisReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        AiAnalysisRecord record = analysisRecordMapper.selectById(req.getAnalysisId());
        if (record == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "AI分析记录不存在");
        }

        record.setReviewResult(req.getReviewResult());
        record.setReviewComment(req.getReviewComment());
        record.setReviewedBy(userId);
        record.setReviewedAt(LocalDateTime.now());
        analysisRecordMapper.updateById(record);

        log.info("Agronomist reviewed AI analysis: analysisId={}, result={}, by={}",
                req.getAnalysisId(), req.getReviewResult(), userId);

        return buildReviewVO(record);
    }

    @Override
    public PageResult<AiAnalysisReviewVO> getAiAnalysisList(Long plotId, int pageNo, int pageSize) {
        Page<AiAnalysisRecord> page = analysisRecordMapper.selectPage(
                new Page<>(pageNo, pageSize),
                new LambdaQueryWrapper<AiAnalysisRecord>()
                        .eq(AiAnalysisRecord::getPlotId, plotId)
                        .orderByDesc(AiAnalysisRecord::getCreatedAt));

        List<AiAnalysisReviewVO> list = page.getRecords().stream()
                .map(this::buildReviewVO)
                .collect(Collectors.toList());

        return PageResult.of(list, pageNo, pageSize, page.getTotal());
    }

    private AiAnalysisReviewVO buildReviewVO(AiAnalysisRecord record) {
        AiAnalysisReviewVO vo = new AiAnalysisReviewVO();
        vo.setAnalysisId(record.getId());
        vo.setPlotId(record.getPlotId());
        vo.setAnalysisType(record.getAnalysisType());
        vo.setReviewResult(record.getReviewResult());
        vo.setReviewComment(record.getReviewComment());
        vo.setReviewedBy(record.getReviewedBy());
        vo.setReviewedAt(record.getReviewedAt() != null ? record.getReviewedAt().format(FMT) : null);
        return vo;
    }
}
