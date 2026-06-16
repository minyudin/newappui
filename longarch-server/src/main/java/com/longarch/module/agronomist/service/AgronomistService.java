package com.longarch.module.agronomist.service;

import com.longarch.common.result.PageResult;
import com.longarch.module.agronomist.dto.CreateHighPriorityTaskReq;
import com.longarch.module.agronomist.dto.ReviewAiAnalysisReq;
import com.longarch.module.agronomist.vo.AiAnalysisReviewVO;
import com.longarch.module.agronomist.vo.CrossPlotSummaryVO;
import com.longarch.module.agronomist.vo.RiskAlertVO;
import com.longarch.module.task.vo.CreateTaskVO;

import java.util.List;

public interface AgronomistService {

    List<RiskAlertVO> getRiskAlerts(Long farmId);

    CrossPlotSummaryVO getCrossPlotSummary(Long farmId);

    CreateTaskVO createHighPriorityTask(CreateHighPriorityTaskReq req);

    AiAnalysisReviewVO reviewAiAnalysis(ReviewAiAnalysisReq req);

    PageResult<AiAnalysisReviewVO> getAiAnalysisList(Long plotId, int pageNo, int pageSize);
}
