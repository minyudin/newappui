package com.longarch.module.agronomist.controller;

import cn.dev33.satoken.annotation.SaCheckRole;
import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.module.agronomist.dto.CreateHighPriorityTaskReq;
import com.longarch.module.agronomist.dto.ReviewAiAnalysisReq;
import com.longarch.module.agronomist.service.AgronomistService;
import com.longarch.module.agronomist.vo.AiAnalysisReviewVO;
import com.longarch.module.agronomist.vo.CrossPlotSummaryVO;
import com.longarch.module.agronomist.vo.RiskAlertVO;
import com.longarch.module.task.vo.CreateTaskVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "农技人员")
@SaCheckRole("agronomist")
@RestController
@RequestMapping("/api/v1/agronomist")
@RequiredArgsConstructor
public class AgronomistController {

    private final AgronomistService agronomistService;

    @Operation(summary = "查询农场风险预警列表")
    @GetMapping("/farms/{farmId}/risk-alerts")
    public R<List<RiskAlertVO>> getRiskAlerts(@PathVariable Long farmId) {
        return R.ok(agronomistService.getRiskAlerts(farmId));
    }

    @Operation(summary = "跨地块数据总览")
    @GetMapping("/farms/{farmId}/summary")
    public R<CrossPlotSummaryVO> getCrossPlotSummary(@PathVariable Long farmId) {
        return R.ok(agronomistService.getCrossPlotSummary(farmId));
    }

    @Operation(summary = "创建高优先级任务")
    @PostMapping("/tasks")
    public R<CreateTaskVO> createHighPriorityTask(@Valid @RequestBody CreateHighPriorityTaskReq req) {
        return R.ok(agronomistService.createHighPriorityTask(req));
    }

    @Operation(summary = "审核AI分析结果")
    @PostMapping("/ai-analysis/review")
    public R<AiAnalysisReviewVO> reviewAiAnalysis(@Valid @RequestBody ReviewAiAnalysisReq req) {
        return R.ok(agronomistService.reviewAiAnalysis(req));
    }

    @Operation(summary = "查询地块AI分析记录列表")
    @GetMapping("/plots/{plotId}/ai-analysis")
    public R<PageResult<AiAnalysisReviewVO>> getAiAnalysisList(
            @PathVariable Long plotId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize) {
        return R.ok(agronomistService.getAiAnalysisList(plotId, pageNo, pageSize));
    }
}
