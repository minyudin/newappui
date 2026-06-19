package com.longarch.module.admin.service;

import com.longarch.common.result.PageResult;
import com.longarch.module.admin.dto.*;
import com.longarch.module.admin.vo.*;

public interface AdminService {

    CreateUserVO createUser(CreateUserReq req);

    CreateAdoptionOrderVO createAdoptionOrder(CreateAdoptionOrderReq req);

    CreateAdoptionCodeVO createAdoptionCode(CreateAdoptionCodeReq req);

    AdoptionCodeDetailVO getCodeDetail(Long codeId);

    CreatePlotVO createPlot(CreatePlotReq req);

    PlotDetailVO getPlotDetail(Long plotId);

    PlotDetailVO updatePlot(Long plotId, UpdatePlotReq req);

    BindCameraVO bindCamera(Long plotId, BindCameraReq req);

    BindActuatorVO bindActuator(Long plotId, BindActuatorReq req);

    BindSensorVO bindSensor(Long plotId, BindSensorReq req);

    /** 停用执行设备（软删除 + 审计 + 防误删校验） */
    void retireActuatorDevice(Long deviceId, RetireDeviceReq req);

    /** 停用传感器设备（软删除 + 审计） */
    void retireSensorDevice(Long sensorId, RetireDeviceReq req);

    BindScreenVO bindScreen(Long plotId, BindScreenReq req);

    CreateCropBatchVO createCropBatch(Long plotId, CreateCropBatchReq req);

    ActuatorDeviceDetailVO getActuatorDevice(Long deviceId);

    UnlockDeviceVO unlockDevice(Long deviceId, UnlockDeviceReq req);

    TakeoverTaskVO takeoverTask(Long taskId, TakeoverTaskReq req);

    // ===== 列表查询 =====

    PageResult<UserListVO> listUsers(int pageNo, int pageSize, String roleType, String keyword);

    /**
     * Admin 强改任意用户昵称
     *  · admin 角色专用 (走 SaCheckRole("admin") 拦截器), 不需要被改用户在线
     *  · 与 changeNickname 共享校验链 (NicknameValidator + uk_nickname)
     *  · 允许覆盖任何状态, 包括从 NULL 设到非 NULL · 不会触发 NICKNAME_ALREADY_SET
     */
    UserListVO updateUserNickname(Long userId, String nickname);

    PageResult<OrderListVO> listOrders(int pageNo, int pageSize, String orderStatus, Long userId);

    PageResult<CodeListVO> listCodes(int pageNo, int pageSize, Long orderId, String status);

    PageResult<PlotListVO> listPlots(int pageNo, int pageSize, String plotStatus, Long parentId);

    PageResult<DeviceListVO> listDevices(int pageNo, int pageSize, Long plotId, String deviceStatus);

    PageResult<TaskListVO> listTasks(int pageNo, int pageSize, Long plotId, String taskStatus);

    // ===== operator 责任域绑定 =====

    OperatorPlotBindingVO bindOperatorPlot(Long operatorUserId, Long plotId, BindOperatorPlotReq req);

    void unbindOperatorPlot(Long operatorUserId, Long plotId);

    PageResult<OperatorPlotBindingVO> listOperatorPlots(Long operatorUserId, int pageNo, int pageSize);

    PageResult<ScreenListVO> listScreens(int pageNo, int pageSize, Long plotId);

    void deleteScreen(Long screenId);

    BindScreenVO regenerateScreenToken(Long screenId);

    // ===== 设备数据查看 =====

    DeviceOverviewVO getDeviceOverview();

    /** 管理后台仪表盘聚合数据（后端 COUNT/GROUP BY 一次算好，替代前端拉整页聚合）。 */
    DashboardSummaryVO getDashboardSummary();

    HardwareAccessInfoVO getHardwareAccessInfo();

    PageResult<SensorDeviceListVO> listSensorDevices(int pageNo, int pageSize, Long plotId, String category);

    PageResult<SensorDataHistoryVO> listSensorData(Long sensorId, int pageNo, int pageSize, String sensorType);

    PlotSensorOverviewVO getPlotSensorOverview(Long plotId);

    // ===== 摄像头管理 =====

    PageResult<CameraListVO> listCameras(int pageNo, int pageSize, Long plotId, String networkStatus);

    CameraListVO updateCamera(Long cameraId, UpdateCameraReq req);

    void deleteCamera(Long cameraId);

    // ===== 状态变更 =====

    OrderListVO updateOrderStatus(Long orderId, UpdateOrderStatusReq req);

    CodeListVO revokeCode(Long codeId, RevokeCodeReq req);
}
