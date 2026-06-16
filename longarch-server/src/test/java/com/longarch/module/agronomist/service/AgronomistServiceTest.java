package com.longarch.module.agronomist.service;

import cn.dev33.satoken.stp.StpUtil;
import com.longarch.BaseTest;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.agronomist.dto.CreateHighPriorityTaskReq;
import com.longarch.module.agronomist.dto.ReviewAiAnalysisReq;
import com.longarch.module.agronomist.vo.AiAnalysisReviewVO;
import com.longarch.module.agronomist.vo.CrossPlotSummaryVO;
import com.longarch.module.agronomist.vo.RiskAlertVO;
import com.longarch.module.task.vo.CreateTaskVO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AgronomistServiceTest extends BaseTest {

    @Autowired
    private AgronomistService agronomistService;

    @BeforeEach
    void loginAsAgronomist() {
        StpUtil.login(4L);
        StpUtil.getSession().set("roleType", "agronomist");
    }

    @AfterEach
    void logout() {
        StpUtil.logout();
    }

    // ===== getRiskAlerts =====

    @Test
    @Order(1)
    void getRiskAlerts_shouldReturnBatchesWithRiskHint() {
        List<RiskAlertVO> alerts = agronomistService.getRiskAlerts(1L);

        assertNotNull(alerts);
        // crop_batch CB-001 有 risk_hint, CB-002 没有
        assertEquals(1, alerts.size());
        assertEquals("注意倒春寒", alerts.get(0).getRiskHint());
        assertEquals("苹果", alerts.get(0).getCropName());
    }

    @Test
    @Order(2)
    void getRiskAlerts_nonExistentFarm_shouldReturnEmpty() {
        List<RiskAlertVO> alerts = agronomistService.getRiskAlerts(999L);
        assertTrue(alerts.isEmpty());
    }

    // ===== getCrossPlotSummary =====

    @Test
    @Order(10)
    void getCrossPlotSummary_success() {
        CrossPlotSummaryVO summary = agronomistService.getCrossPlotSummary(1L);

        assertEquals(1L, summary.getFarmId());
        assertEquals(2, summary.getTotalPlots());
        assertEquals(1, summary.getRiskPlots()); // 只有 CB-001 有 risk_hint
        assertFalse(summary.getPlots().isEmpty());
    }

    // ===== createHighPriorityTask =====

    @Test
    @Order(20)
    void createHighPriorityTask_success() {
        CreateHighPriorityTaskReq req = new CreateHighPriorityTaskReq();
        req.setPlotId(1L);
        req.setDeviceId(1L);
        req.setActionType("irrigation_start");
        req.setPriority(1);
        req.setReason("紧急干旱");

        CreateTaskVO vo = agronomistService.createHighPriorityTask(req);

        assertNotNull(vo.getTaskId());
        assertNotNull(vo.getTaskNo());
        // 走调度器：设备空闲→running（立即派发），设备忙→queued（入队等待）
        assertTrue("running".equals(vo.getTaskStatus()) || "queued".equals(vo.getTaskStatus()),
                "taskStatus should be running or queued, but was: " + vo.getTaskStatus());
        assertTrue(vo.getMessage().contains("高优先级"));
    }

    // ===== reviewAiAnalysis =====

    @Test
    @Order(30)
    void reviewAiAnalysis_approve_success() {
        ReviewAiAnalysisReq req = new ReviewAiAnalysisReq();
        req.setAnalysisId(1L);
        req.setReviewResult("approved");
        req.setReviewComment("分析准确，同意建议");

        AiAnalysisReviewVO vo = agronomistService.reviewAiAnalysis(req);

        assertEquals(1L, vo.getAnalysisId());
        assertEquals("approved", vo.getReviewResult());
        assertEquals("分析准确，同意建议", vo.getReviewComment());
        assertEquals(4L, vo.getReviewedBy());
        assertNotNull(vo.getReviewedAt());
    }

    @Test
    @Order(31)
    void reviewAiAnalysis_notFound_shouldFail() {
        ReviewAiAnalysisReq req = new ReviewAiAnalysisReq();
        req.setAnalysisId(9999L);
        req.setReviewResult("rejected");

        assertThrows(BizException.class, () -> agronomistService.reviewAiAnalysis(req));
    }

    // ===== getAiAnalysisList =====

    @Test
    @Order(40)
    void getAiAnalysisList_success() {
        PageResult<AiAnalysisReviewVO> result = agronomistService.getAiAnalysisList(1L, 1, 10);

        assertNotNull(result);
        assertEquals(2, result.getTotal());
    }
}
