package com.longarch.module.operator.service;

import cn.dev33.satoken.stp.StpUtil;
import com.longarch.BaseTest;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.operator.dto.CreateFarmingRecordReq;
import com.longarch.module.operator.dto.UpdateCropBatchReq;
import com.longarch.module.operator.vo.CropBatchDetailVO;
import com.longarch.module.operator.vo.FarmTaskListVO;
import com.longarch.module.operator.vo.FarmingRecordDetailVO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class OperatorServiceTest extends BaseTest {

    @Autowired
    private OperatorService operatorService;

    @BeforeEach
    void loginAsOperator() {
        StpUtil.login(3L);
        StpUtil.getSession().set("roleType", "operator");
    }

    @AfterEach
    void logout() {
        StpUtil.logout();
    }

    // ===== createFarmingRecord =====

    @Test
    @Order(1)
    void createFarmingRecord_success() {
        CreateFarmingRecordReq req = new CreateFarmingRecordReq();
        req.setPlotId(1L);
        req.setCropBatchId(1L);
        req.setRecordType("irrigation");
        req.setRecordTitle("灌溉记录");
        req.setRecordTime("2026-04-15 10:00:00");
        req.setDescription("浇水30分钟");

        FarmingRecordDetailVO vo = operatorService.createFarmingRecord(req);

        assertNotNull(vo.getRecordId());
        assertEquals(1L, vo.getPlotId());
        assertEquals("irrigation", vo.getRecordType());
        assertEquals("灌溉记录", vo.getRecordTitle());
        assertEquals("王运营", vo.getOperatorName());
    }

    // ===== getFarmingRecords =====

    @Test
    @Order(2)
    void getFarmingRecords_success() {
        // 先插一条
        CreateFarmingRecordReq req = new CreateFarmingRecordReq();
        req.setPlotId(1L);
        req.setRecordType("fertilize");
        req.setRecordTitle("施肥记录");
        operatorService.createFarmingRecord(req);

        PageResult<FarmingRecordDetailVO> result = operatorService.getFarmingRecords(1L, 1, 10);

        assertNotNull(result);
        assertTrue(result.getTotal() >= 1);
    }

    // ===== updateCropBatch =====

    @Test
    @Order(10)
    void updateCropBatch_success() {
        UpdateCropBatchReq req = new UpdateCropBatchReq();
        req.setGrowthStage("fruiting");
        req.setNextTask("果实膨大期管理");

        CropBatchDetailVO vo = operatorService.updateCropBatch(1L, req);

        assertEquals(1L, vo.getCropBatchId());
        assertEquals("fruiting", vo.getGrowthStage());
        assertEquals("果实膨大期管理", vo.getNextTask());
    }

    @Test
    @Order(11)
    void updateCropBatch_notFound_shouldFail() {
        UpdateCropBatchReq req = new UpdateCropBatchReq();
        req.setGrowthStage("harvesting");

        assertThrows(BizException.class, () -> operatorService.updateCropBatch(9999L, req));
    }

    // ===== getCropBatchDetail =====

    @Test
    @Order(20)
    void getCropBatchDetail_success() {
        CropBatchDetailVO vo = operatorService.getCropBatchDetail(1L);

        assertEquals(1L, vo.getCropBatchId());
        assertEquals("苹果", vo.getCropName());
        assertEquals("红富士", vo.getVarietyName());
    }

    @Test
    @Order(21)
    void getCropBatchDetail_notFound_shouldFail() {
        assertThrows(BizException.class, () -> operatorService.getCropBatchDetail(9999L));
    }

    // ===== getFarmTasks =====

    @Test
    @Order(30)
    void getFarmTasks_emptyResult() {
        PageResult<FarmTaskListVO> result = operatorService.getFarmTasks(1L, 1, 10, null);

        assertNotNull(result);
        // 初始数据里没有任务，应返回空列表
        assertEquals(0, result.getTotal());
    }
}
