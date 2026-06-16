package com.longarch.module.admin.service;

import cn.dev33.satoken.stp.StpUtil;
import com.longarch.BaseTest;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.admin.dto.*;
import com.longarch.module.admin.vo.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AdminServiceTest extends BaseTest {

    @Autowired
    private AdminService adminService;

    @BeforeEach
    void loginAsAdmin() {
        StpUtil.login(1L);
        StpUtil.getSession().set("roleType", "admin");
    }

    @AfterEach
    void logout() {
        StpUtil.logout();
    }

    // ===== createUser =====

    @Test
    @Order(1)
    void createUser_success() {
        CreateUserReq req = new CreateUserReq();
        req.setOpenId("test_new_user_openid");
        req.setNickname("测试用户");
        req.setRoleType("operator");

        CreateUserVO vo = adminService.createUser(req);

        assertNotNull(vo.getUserId());
        assertNotNull(vo.getUserNo());
        assertEquals("operator", vo.getRoleType());
        assertEquals(1, vo.getStatus());
    }

    @Test
    @Order(2)
    void createUser_duplicateOpenId_shouldFail() {
        CreateUserReq req = new CreateUserReq();
        req.setOpenId("admin_openid"); // 已存在
        req.setRoleType("adopter");

        assertThrows(BizException.class, () -> adminService.createUser(req));
    }

    @Test
    @Order(3)
    void createUser_invalidRole_shouldFail() {
        CreateUserReq req = new CreateUserReq();
        req.setOpenId("bad_role_user");
        req.setRoleType("superadmin");

        assertThrows(BizException.class, () -> adminService.createUser(req));
    }

    // ===== createAdoptionOrder =====

    @Test
    @Order(10)
    void createAdoptionOrder_success() {
        CreateAdoptionOrderReq req = new CreateAdoptionOrderReq();
        req.setPlotId(1L);
        req.setUserId(2L);
        req.setStartAt("2026-06-01 00:00:00");
        req.setEndAt("2026-12-31 23:59:59");
        req.setPayableAmount(new BigDecimal("1999.00"));
        req.setRemark("测试订单");

        CreateAdoptionOrderVO vo = adminService.createAdoptionOrder(req);

        assertNotNull(vo.getOrderId());
        assertNotNull(vo.getOrderNo());
        assertEquals(1L, vo.getPlotId());
        assertEquals(2L, vo.getUserId());
        assertEquals("pending", vo.getOrderStatus());
        assertEquals("unpaid", vo.getPayStatus());
        assertEquals(1L, vo.getCreatedBy()); // admin userId
    }

    // ===== createAdoptionCode =====

    @Test
    @Order(11)
    void createAdoptionCode_success() {
        CreateAdoptionCodeReq req = new CreateAdoptionCodeReq();
        req.setOrderId(1L);
        req.setCodeType("guest");
        req.setValidFrom("2026-01-01 00:00:00");
        req.setValidTo("2026-12-31 23:59:59");

        CreateAdoptionCodeVO vo = adminService.createAdoptionCode(req);

        assertNotNull(vo.getAdoptionCodeId());
        assertNotNull(vo.getCode());
        assertTrue(vo.getCode().startsWith("LSGJ-"));
        assertEquals("guest", vo.getCodeType());
        assertEquals("active", vo.getStatus());
    }

    @Test
    @Order(12)
    void createAdoptionCode_orderNotFound_shouldFail() {
        CreateAdoptionCodeReq req = new CreateAdoptionCodeReq();
        req.setOrderId(9999L);
        req.setValidFrom("2026-01-01 00:00:00");
        req.setValidTo("2026-12-31 23:59:59");

        assertThrows(BizException.class, () -> adminService.createAdoptionCode(req));
    }

    // ===== createPlot =====

    @Test
    @Order(20)
    void createPlot_success() {
        CreatePlotReq req = new CreatePlotReq();
        req.setPlotName("新测试地块");
        req.setFarmId(1L);
        req.setAreaSize(new BigDecimal("2.5"));
        req.setAreaUnit("mu");

        CreatePlotVO vo = adminService.createPlot(req);

        assertNotNull(vo.getPlotId());
        assertNotNull(vo.getPlotNo());
        assertEquals("新测试地块", vo.getPlotName());
        assertEquals("active", vo.getPlotStatus());
    }

    // ===== bindCamera =====

    @Test
    @Order(30)
    void bindCamera_success() {
        BindCameraReq req = new BindCameraReq();
        req.setCameraName("测试摄像头");

        BindCameraVO vo = adminService.bindCamera(1L, req);

        assertTrue(vo.getBindSuccess());
        assertEquals(1L, vo.getPlotId());
        assertNotNull(vo.getCameraId());
    }

    // ===== bindActuator =====

    @Test
    @Order(31)
    void bindActuator_success() {
        BindActuatorReq req = new BindActuatorReq();
        req.setDeviceName("测试喷灌器");
        req.setDeviceType("irrigator");

        BindActuatorVO vo = adminService.bindActuator(2L, req);

        assertTrue(vo.getBindSuccess());
        assertEquals(2L, vo.getPlotId());
        assertEquals("irrigator", vo.getDeviceType());
    }

    @Test
    @Order(32)
    void bindActuator_duplicateSingleton_shouldFail() {
        BindActuatorReq req = new BindActuatorReq();
        req.setDeviceName("重复灌溉器");
        req.setDeviceType("irrigator");

        assertThrows(BizException.class, () -> adminService.bindActuator(1L, req));
    }

    // ===== getActuatorDevice =====

    @Test
    @Order(40)
    void getActuatorDevice_success() {
        ActuatorDeviceDetailVO vo = adminService.getActuatorDevice(1L);

        assertEquals(1L, vo.getDeviceId());
        assertEquals("free", vo.getLockStatus());
    }

    @Test
    @Order(41)
    void getActuatorDevice_notFound_shouldFail() {
        assertThrows(BizException.class, () -> adminService.getActuatorDevice(9999L));
    }

    // ===== unlockDevice =====

    @Test
    @Order(50)
    void unlockDevice_success() {
        UnlockDeviceReq req = new UnlockDeviceReq();
        req.setReason("测试解锁");

        UnlockDeviceVO vo = adminService.unlockDevice(1L, req);

        assertTrue(vo.getUnlockSuccess());
        assertEquals("free", vo.getLockStatus());
        assertEquals(1L, vo.getOperatorId());
    }

    // ===== 列表查询 =====

    @Test
    @Order(60)
    void listUsers_all() {
        PageResult<UserListVO> result = adminService.listUsers(1, 10, null, null);
        assertNotNull(result);
        assertTrue(result.getTotal() >= 4); // seed data has 4 users
        assertEquals(1, result.getPageNo());
    }

    @Test
    @Order(61)
    void listUsers_filterByRole() {
        PageResult<UserListVO> result = adminService.listUsers(1, 10, "admin", null);
        assertEquals(1, result.getTotal());
        assertEquals("admin", result.getList().get(0).getRoleType());
    }

    @Test
    @Order(62)
    void listUsers_searchByKeyword() {
        PageResult<UserListVO> result = adminService.listUsers(1, 10, null, "管理");
        assertTrue(result.getTotal() >= 1);
    }

    @Test
    @Order(70)
    void listOrders_all() {
        PageResult<OrderListVO> result = adminService.listOrders(1, 10, null, null);
        assertNotNull(result);
        assertTrue(result.getTotal() >= 1); // seed data has 1 order
    }

    @Test
    @Order(71)
    void listOrders_filterByStatus() {
        PageResult<OrderListVO> result = adminService.listOrders(1, 10, "active", null);
        assertEquals(1, result.getTotal());
        assertEquals("active", result.getList().get(0).getOrderStatus());
    }

    @Test
    @Order(72)
    void listOrders_filterByUserId() {
        PageResult<OrderListVO> result = adminService.listOrders(1, 10, null, 2L);
        assertTrue(result.getTotal() >= 1);
        assertEquals(2L, result.getList().get(0).getUserId());
    }

    @Test
    @Order(80)
    void listCodes_all() {
        PageResult<CodeListVO> result = adminService.listCodes(1, 10, null, null);
        assertTrue(result.getTotal() >= 3); // seed data has 3 codes
    }

    @Test
    @Order(81)
    void listCodes_filterByOrderId() {
        PageResult<CodeListVO> result = adminService.listCodes(1, 10, 1L, null);
        assertTrue(result.getTotal() >= 3);
    }

    @Test
    @Order(82)
    void listCodes_filterByStatus() {
        PageResult<CodeListVO> result = adminService.listCodes(1, 10, null, "active");
        assertTrue(result.getTotal() >= 2);
    }

    @Test
    @Order(90)
    void listPlots_all() {
        PageResult<PlotListVO> result = adminService.listPlots(1, 10, null, null);
        assertTrue(result.getTotal() >= 2); // seed data has 2 plots
    }

    @Test
    @Order(91)
    void listPlots_filterByStatus() {
        PageResult<PlotListVO> result = adminService.listPlots(1, 10, "active", null);
        assertTrue(result.getTotal() >= 2);
    }

    @Test
    @Order(100)
    void listDevices_all() {
        PageResult<DeviceListVO> result = adminService.listDevices(1, 10, null, null);
        assertTrue(result.getTotal() >= 1); // seed data has 1 actuator
        assertEquals("free", result.getList().get(0).getLockStatus());
    }

    @Test
    @Order(101)
    void listDevices_filterByPlotId() {
        PageResult<DeviceListVO> result = adminService.listDevices(1, 10, 1L, null);
        assertTrue(result.getTotal() >= 1);
        assertEquals(1L, result.getList().get(0).getPlotId());
    }

    @Test
    @Order(110)
    void listTasks_all() {
        PageResult<TaskListVO> result = adminService.listTasks(1, 10, null, null);
        assertNotNull(result);
        // seed data has 0 tasks, total could be 0
        assertTrue(result.getTotal() >= 0);
    }

    // ===== 状态变更 =====

    @Test
    @Order(120)
    void updateOrderStatus_toActive() {
        UpdateOrderStatusReq req = new UpdateOrderStatusReq();
        req.setOrderStatus("active");
        req.setPayStatus("paid");
        req.setRemark("审核通过");

        OrderListVO vo = adminService.updateOrderStatus(1L, req);

        assertEquals(1L, vo.getOrderId());
        assertEquals("active", vo.getOrderStatus());
        assertEquals("paid", vo.getPayStatus());
        assertEquals("审核通过", vo.getRemark());
    }

    @Test
    @Order(121)
    void updateOrderStatus_invalidStatus_shouldFail() {
        UpdateOrderStatusReq req = new UpdateOrderStatusReq();
        req.setOrderStatus("invalid_status");

        assertThrows(BizException.class, () -> adminService.updateOrderStatus(1L, req));
    }

    @Test
    @Order(122)
    void updateOrderStatus_notFound_shouldFail() {
        UpdateOrderStatusReq req = new UpdateOrderStatusReq();
        req.setOrderStatus("active");

        assertThrows(BizException.class, () -> adminService.updateOrderStatus(9999L, req));
    }

    @Test
    @Order(130)
    void revokeCode_success() {
        RevokeCodeReq req = new RevokeCodeReq();
        req.setReason("测试吊销");

        CodeListVO vo = adminService.revokeCode(2L, req); // guest code

        assertEquals(2L, vo.getCodeId());
        assertEquals("revoked", vo.getStatus());
    }

    @Test
    @Order(131)
    void revokeCode_alreadyRevoked_shouldFail() {
        // 先吊销
        adminService.revokeCode(2L, new RevokeCodeReq());
        // 再吊销
        assertThrows(BizException.class, () -> adminService.revokeCode(2L, new RevokeCodeReq()));
    }

    @Test
    @Order(132)
    void revokeCode_notFound_shouldFail() {
        assertThrows(BizException.class, () -> adminService.revokeCode(9999L, new RevokeCodeReq()));
    }
}
