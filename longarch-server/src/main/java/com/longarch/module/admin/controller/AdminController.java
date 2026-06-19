package com.longarch.module.admin.controller;

import cn.dev33.satoken.annotation.SaCheckRole;
import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.module.admin.dto.*;
import com.longarch.module.admin.service.AdminService;
import com.longarch.module.admin.vo.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "管理后台")
@SaCheckRole("admin")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @Operation(summary = "创建用户（指定角色）")
    @PostMapping("/users")
    public R<CreateUserVO> createUser(@Valid @RequestBody CreateUserReq req) {
        return R.ok(adminService.createUser(req));
    }

    @Operation(summary = "管理员强改用户昵称")
    @PutMapping("/users/{userId}/nickname")
    public R<UserListVO> updateUserNickname(
            @PathVariable Long userId,
            @Valid @RequestBody com.longarch.module.auth.dto.SetupNicknameReq req) {
        return R.ok(adminService.updateUserNickname(userId, req.getNickname()));
    }

    @Operation(summary = "API-28 创建认养订单")
    @PostMapping("/adoption-orders")
    public R<CreateAdoptionOrderVO> createAdoptionOrder(@Valid @RequestBody CreateAdoptionOrderReq req) {
        return R.ok(adminService.createAdoptionOrder(req));
    }

    @Operation(summary = "API-29 创建认养码")
    @PostMapping("/adoption-codes")
    public R<CreateAdoptionCodeVO> createAdoptionCode(@Valid @RequestBody CreateAdoptionCodeReq req) {
        return R.ok(adminService.createAdoptionCode(req));
    }

    @Operation(summary = "认养码详情 (含完整权限矩阵 + 时间窗)")
    @GetMapping("/adoption-codes/{codeId}")
    public R<AdoptionCodeDetailVO> getCodeDetail(@PathVariable Long codeId) {
        return R.ok(adminService.getCodeDetail(codeId));
    }

    @Operation(summary = "API-30 创建地块")
    @PostMapping("/plots")
    public R<CreatePlotVO> createPlot(@Valid @RequestBody CreatePlotReq req) {
        return R.ok(adminService.createPlot(req));
    }

    @Operation(summary = "地块详情 (含经纬度 / 封面 / 简介)")
    @GetMapping("/plots/{plotId}")
    public R<PlotDetailVO> getPlotDetail(@PathVariable Long plotId) {
        return R.ok(adminService.getPlotDetail(plotId));
    }

    @Operation(summary = "更新地块 (部分字段, null = 不改)")
    @PutMapping("/plots/{plotId}")
    public R<PlotDetailVO> updatePlot(@PathVariable Long plotId, @Valid @RequestBody UpdatePlotReq req) {
        return R.ok(adminService.updatePlot(plotId, req));
    }

    @Operation(summary = "API-31 绑定摄像头到地块")
    @PostMapping("/plots/{plotId}/bind-camera")
    public R<BindCameraVO> bindCamera(@PathVariable Long plotId, @Valid @RequestBody BindCameraReq req) {
        return R.ok(adminService.bindCamera(plotId, req));
    }

    @Operation(summary = "API-32 绑定执行设备到地块")
    @PostMapping("/plots/{plotId}/bind-actuator")
    public R<BindActuatorVO> bindActuator(@PathVariable Long plotId, @Valid @RequestBody BindActuatorReq req) {
        return R.ok(adminService.bindActuator(plotId, req));
    }

    @Operation(summary = "API-40 绑定传感器到地块")
    @PostMapping("/plots/{plotId}/bind-sensor")
    public R<BindSensorVO> bindSensor(@PathVariable Long plotId, @Valid @RequestBody BindSensorReq req) {
        return R.ok(adminService.bindSensor(plotId, req));
    }

    @Operation(summary = "API-45 绑定大屏到地块")
    @PostMapping("/plots/{plotId}/bind-screen")
    public R<BindScreenVO> bindScreen(@PathVariable Long plotId, @Valid @RequestBody BindScreenReq req) {
        return R.ok(adminService.bindScreen(plotId, req));
    }

    @Operation(summary = "API-41 创建作物批次")
    @PostMapping("/plots/{plotId}/crop-batches")
    public R<CreateCropBatchVO> createCropBatch(@PathVariable Long plotId, @Valid @RequestBody CreateCropBatchReq req) {
        return R.ok(adminService.createCropBatch(plotId, req));
    }

    @Operation(summary = "API-33 查询执行设备详情")
    @GetMapping("/actuator-devices/{deviceId}")
    public R<ActuatorDeviceDetailVO> getActuatorDevice(@PathVariable Long deviceId) {
        return R.ok(adminService.getActuatorDevice(deviceId));
    }

    @Operation(summary = "停用执行设备（软删除）")
    @PostMapping("/actuator-devices/{deviceId}/retire")
    public R<Void> retireActuatorDevice(@PathVariable Long deviceId, @Valid @RequestBody RetireDeviceReq req) {
        adminService.retireActuatorDevice(deviceId, req);
        return R.ok(null);
    }

    @Operation(summary = "API-34 强制释放设备锁")
    @PostMapping("/actuator-devices/{deviceId}/unlock")
    public R<UnlockDeviceVO> unlockDevice(@PathVariable Long deviceId, @RequestBody(required = false) UnlockDeviceReq req) {
        return R.ok(adminService.unlockDevice(deviceId, req));
    }

    @Operation(summary = "API-35 接管任务")
    @PostMapping("/operation-tasks/{taskId}/takeover")
    public R<TakeoverTaskVO> takeoverTask(@PathVariable Long taskId, @RequestBody(required = false) TakeoverTaskReq req) {
        return R.ok(adminService.takeoverTask(taskId, req));
    }

    // ===== 列表查询 =====

    @Operation(summary = "用户列表")
    @GetMapping("/users")
    public R<PageResult<UserListVO>> listUsers(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String roleType,
            @RequestParam(required = false) String keyword) {
        return R.ok(adminService.listUsers(pageNo, pageSize, roleType, keyword));
    }

    @Operation(summary = "认养订单列表")
    @GetMapping("/adoption-orders")
    public R<PageResult<OrderListVO>> listOrders(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String orderStatus,
            @RequestParam(required = false) Long userId) {
        return R.ok(adminService.listOrders(pageNo, pageSize, orderStatus, userId));
    }

    @Operation(summary = "认养码列表")
    @GetMapping("/adoption-codes")
    public R<PageResult<CodeListVO>> listCodes(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String status) {
        return R.ok(adminService.listCodes(pageNo, pageSize, orderId, status));
    }

    @Operation(summary = "地块列表")
    @GetMapping("/plots")
    public R<PageResult<PlotListVO>> listPlots(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String plotStatus,
            @RequestParam(required = false) Long parentId) {
        return R.ok(adminService.listPlots(pageNo, pageSize, plotStatus, parentId));
    }

    @Operation(summary = "执行设备列表")
    @GetMapping("/actuator-devices")
    public R<PageResult<DeviceListVO>> listDevices(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) String deviceStatus) {
        return R.ok(adminService.listDevices(pageNo, pageSize, plotId, deviceStatus));
    }

    @Operation(summary = "操作任务列表")
    @GetMapping("/operation-tasks")
    public R<PageResult<TaskListVO>> listTasks(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) String taskStatus) {
        return R.ok(adminService.listTasks(pageNo, pageSize, plotId, taskStatus));
    }

    @Operation(summary = "绑定operator到地块责任域")
    @PostMapping("/operators/{operatorUserId}/plots/{plotId}/bind")
    public R<OperatorPlotBindingVO> bindOperatorPlot(
            @PathVariable Long operatorUserId,
            @PathVariable Long plotId,
            @Valid @RequestBody(required = false) BindOperatorPlotReq req) {
        return R.ok(adminService.bindOperatorPlot(operatorUserId, plotId, req == null ? new BindOperatorPlotReq() : req));
    }

    @Operation(summary = "解绑operator地块责任域")
    @PostMapping("/operators/{operatorUserId}/plots/{plotId}/unbind")
    public R<Void> unbindOperatorPlot(
            @PathVariable Long operatorUserId,
            @PathVariable Long plotId) {
        adminService.unbindOperatorPlot(operatorUserId, plotId);
        return R.ok(null);
    }

    @Operation(summary = "查询operator地块责任域")
    @GetMapping("/operators/{operatorUserId}/plots")
    public R<PageResult<OperatorPlotBindingVO>> listOperatorPlots(
            @PathVariable Long operatorUserId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize) {
        return R.ok(adminService.listOperatorPlots(operatorUserId, pageNo, pageSize));
    }

    @Operation(summary = "API-47 大屏列表")
    @GetMapping("/screens")
    public R<PageResult<ScreenListVO>> listScreens(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long plotId) {
        return R.ok(adminService.listScreens(pageNo, pageSize, plotId));
    }

    @Operation(summary = "API-48 删除大屏")
    @DeleteMapping("/screens/{screenId}")
    public R<Void> deleteScreen(@PathVariable Long screenId) {
        adminService.deleteScreen(screenId);
        return R.ok(null);
    }

    @Operation(summary = "API-49 重新生成大屏Token")
    @PostMapping("/screens/{screenId}/regenerate-token")
    public R<BindScreenVO> regenerateScreenToken(@PathVariable Long screenId) {
        return R.ok(adminService.regenerateScreenToken(screenId));
    }

    // ===== 设备数据查看 =====

    @Operation(summary = "API-50 设备状态总览")
    @GetMapping("/device-overview")
    public R<DeviceOverviewVO> getDeviceOverview() {
        return R.ok(adminService.getDeviceOverview());
    }

    @Operation(summary = "仪表盘聚合数据（后端聚合，替代前端拉整页 list 计数）")
    @GetMapping("/dashboard-summary")
    public R<DashboardSummaryVO> getDashboardSummary() {
        return R.ok(adminService.getDashboardSummary());
    }

    @Operation(summary = "MQTT hardware access info")
    @GetMapping("/hardware-access")
    public R<HardwareAccessInfoVO> getHardwareAccessInfo() {
        return R.ok(adminService.getHardwareAccessInfo());
    }

    @Operation(summary = "API-51 传感器设备列表（含最新数据）")
    @GetMapping("/sensor-devices")
    public R<PageResult<SensorDeviceListVO>> listSensorDevices(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) String category) {
        return R.ok(adminService.listSensorDevices(pageNo, pageSize, plotId, category));
    }

    @Operation(summary = "停用传感器设备（软删除）")
    @PostMapping("/sensor-devices/{sensorId}/retire")
    public R<Void> retireSensorDevice(@PathVariable Long sensorId, @Valid @RequestBody RetireDeviceReq req) {
        adminService.retireSensorDevice(sensorId, req);
        return R.ok(null);
    }

    @Operation(summary = "API-52 传感器历史数据")
    @GetMapping("/sensor-devices/{sensorId}/data")
    public R<PageResult<SensorDataHistoryVO>> listSensorData(
            @PathVariable Long sensorId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "50") int pageSize,
            @RequestParam(required = false) String sensorType) {
        return R.ok(adminService.listSensorData(sensorId, pageNo, pageSize, sensorType));
    }

    @Operation(summary = "API-53 地块传感器数据总览（按环境/土壤分组）")
    @GetMapping("/plots/{plotId}/sensor-overview")
    public R<PlotSensorOverviewVO> getPlotSensorOverview(@PathVariable Long plotId) {
        return R.ok(adminService.getPlotSensorOverview(plotId));
    }

    // ===== 摄像头管理 =====

    @Operation(summary = "API-54 摄像头列表")
    @GetMapping("/cameras")
    public R<PageResult<CameraListVO>> listCameras(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long plotId,
            @RequestParam(required = false) String networkStatus) {
        return R.ok(adminService.listCameras(pageNo, pageSize, plotId, networkStatus));
    }

    @Operation(summary = "API-55 更新摄像头信息")
    @PutMapping("/cameras/{cameraId}")
    public R<CameraListVO> updateCamera(@PathVariable Long cameraId, @Valid @RequestBody UpdateCameraReq req) {
        return R.ok(adminService.updateCamera(cameraId, req));
    }

    @Operation(summary = "API-56 删除摄像头")
    @DeleteMapping("/cameras/{cameraId}")
    public R<Void> deleteCamera(@PathVariable Long cameraId) {
        adminService.deleteCamera(cameraId);
        return R.ok(null);
    }

    // ===== 状态变更 =====

    @Operation(summary = "更新订单状态（审核/取消等）")
    @PutMapping("/adoption-orders/{orderId}/status")
    public R<OrderListVO> updateOrderStatus(@PathVariable Long orderId, @Valid @RequestBody UpdateOrderStatusReq req) {
        return R.ok(adminService.updateOrderStatus(orderId, req));
    }

    @Operation(summary = "吊销认养码")
    @PostMapping("/adoption-codes/{codeId}/revoke")
    public R<CodeListVO> revokeCode(@PathVariable Long codeId, @RequestBody(required = false) RevokeCodeReq req) {
        return R.ok(adminService.revokeCode(codeId, req));
    }
}
