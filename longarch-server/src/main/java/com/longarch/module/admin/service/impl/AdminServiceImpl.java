package com.longarch.module.admin.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.longarch.common.config.RateLimitProperties;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.common.service.RateLimitService;
import com.longarch.common.util.NicknameValidator;
import cn.dev33.satoken.stp.StpUtil;
import com.longarch.module.admin.dto.*;
import com.longarch.module.admin.service.AdminService;
import com.longarch.module.admin.vo.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.module.admin.entity.DeviceLifecycleLog;
import com.longarch.module.admin.mapper.DeviceLifecycleLogMapper;
import com.longarch.module.auth.entity.User;
import com.longarch.module.auth.mapper.UserMapper;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.entity.AdoptionOrder;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.adoption.mapper.AdoptionOrderMapper;
import com.longarch.module.camera.entity.CameraDevice;
import com.longarch.module.camera.mapper.CameraDeviceMapper;
import com.longarch.module.edge.entity.EdgeNode;
import com.longarch.module.edge.mapper.EdgeNodeMapper;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.common.config.BusinessDefaultsProperties;
import com.longarch.common.config.DeviceNoProperties;
import com.longarch.common.config.MediaServerProperties;
import com.longarch.common.config.MqttProperties;
import com.longarch.module.screen.entity.ScreenDevice;
import com.longarch.module.screen.mapper.ScreenDeviceMapper;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.entity.DeviceLock;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.entity.OperatorPlotBinding;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import com.longarch.module.task.mapper.DeviceLockMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.mapper.OperatorPlotBindingMapper;
import com.longarch.module.camera.service.SrsStreamService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private final UserMapper userMapper;
    private final AdoptionOrderMapper orderMapper;
    private final AdoptionCodeMapper codeMapper;
    private final PlotMapper plotMapper;
    private final CameraDeviceMapper cameraMapper;
    private final EdgeNodeMapper edgeNodeMapper;
    private final ActuatorDeviceMapper actuatorMapper;
    private final DeviceLockMapper deviceLockMapper;
    private final OperationTaskMapper taskMapper;
    private final OperatorPlotBindingMapper operatorPlotBindingMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final ScreenDeviceMapper screenDeviceMapper;
    private final CropBatchMapper cropBatchMapper;
    private final SensorDataMapper sensorDataMapper;
    private final DeviceLifecycleLogMapper deviceLifecycleLogMapper;
    private final ObjectMapper objectMapper;
    private final MqttProperties mqttProperties;
    private final MediaServerProperties mediaServerProperties;
    private final DeviceNoProperties deviceNoProperties;
    private final SrsStreamService srsStreamService;
    private final BusinessDefaultsProperties bizDefaults;
    private final RateLimitService rateLimitService;
    private final RateLimitProperties rateLimitProperties;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Set<String> ALLOWED_ROLES = Set.of("admin", "operator", "agronomist", "adopter");
    /**
     * 单槽位执行器：同地块同类只允许 1 个“生效中”的设备。
     * 如需要换设备，必须显式走 replace（停用旧设备再绑定新设备）。
     */
    private static final Set<String> SINGLETON_ACTUATOR_TYPES = Set.of("irrigator", "fertilizer", "sprayer");

    @Override
    @Transactional
    public CreateUserVO createUser(CreateUserReq req) {
        if (!ALLOWED_ROLES.contains(req.getRoleType())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "不支持的角色类型: " + req.getRoleType());
        }

        Long existCount = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getOpenId, req.getOpenId()));
        if (existCount > 0) {
            throw new BizException(ErrorCode.INVALID_PARAM, "该openId已注册");
        }

        // 昵称强制规范化 + 校验合规 + 唯一 (与 miniapp setupNickname 同一规则,
        // 让 admin 端创建的用户和微信用户在唯一空间里和平共处)
        String nicknameInput = req.getNickname() != null ? req.getNickname().trim() : "";
        String nickname;
        if (nicknameInput.isEmpty()) {
            // admin 创建时未填昵称, 与微信注册"待激活"语义一致, 落 NULL
            nickname = null;
        } else {
            nickname = NicknameValidator.normalize(nicknameInput);
            NicknameValidator.validate(nickname);
            Long sameNameCount = userMapper.selectCount(
                    new LambdaQueryWrapper<User>().eq(User::getNickname, nickname));
            if (sameNameCount != null && sameNameCount > 0) {
                throw new BizException(ErrorCode.NICKNAME_DUPLICATED, "昵称已被占用, 请换一个");
            }
        }

        User user = new User();
        user.setOpenId(req.getOpenId());
        user.setUserNo(bizDefaults.getUserNoPrefix() + IdUtil.getSnowflakeNextIdStr());
        user.setNickname(nickname);
        user.setRealName(req.getRealName());
        user.setMobile(req.getMobile());
        user.setRoleType(req.getRoleType());
        user.setStatus(1);
        user.setBindMobile(req.getMobile() != null ? 1 : 0);
        userMapper.insert(user);

        log.info("Admin created user: userId={}, userNo={}, roleType={}", user.getId(), user.getUserNo(), user.getRoleType());

        CreateUserVO vo = new CreateUserVO();
        vo.setUserId(user.getId());
        vo.setUserNo(user.getUserNo());
        vo.setRoleType(user.getRoleType());
        vo.setStatus(user.getStatus());
        return vo;
    }

    /**
     * Admin 强改任意用户昵称
     *  · 复用 NicknameValidator + 应用层 SELECT 预检 + DB uk_nickname 兜底
     *  · 不要求被改用户在线 · 不区分 nickname 是否为 NULL (覆盖任何状态)
     *  · 与同名值幂等 (返当前 VO 不动 DB)
     */
    @Override
    @Transactional
    public UserListVO updateUserNickname(Long userId, String nickname) {
        if (userId == null) {
            throw new BizException(ErrorCode.INVALID_PARAM, "userId 不能为空");
        }
        String normalized = NicknameValidator.normalize(nickname);
        NicknameValidator.validate(normalized);

        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在");
        }

        // 同名幂等
        if (normalized.equals(user.getNickname())) {
            log.info("admin updateUserNickname noop (same value): userId={}", userId);
        } else {
            // 应用层去重
            Long sameNameCount = userMapper.selectCount(
                    new LambdaQueryWrapper<User>()
                            .eq(User::getNickname, normalized)
                            .ne(User::getId, userId));
            if (sameNameCount != null && sameNameCount > 0) {
                throw new BizException(ErrorCode.NICKNAME_DUPLICATED, "昵称已被占用, 请换一个");
            }
            try {
                User patch = new User();
                patch.setId(userId);
                patch.setNickname(normalized);
                userMapper.updateById(patch);
                user.setNickname(normalized);
            } catch (org.springframework.dao.DuplicateKeyException e) {
                log.warn("admin updateUserNickname duplicate at DB: nickname={}, userId={}", normalized, userId);
                throw new BizException(ErrorCode.NICKNAME_DUPLICATED, "昵称已被占用, 请换一个");
            }
            Long operatorId = StpUtil.isLogin() ? StpUtil.getLoginIdAsLong() : null;
            log.info("admin updateUserNickname ok: userId={}, nickname={}, by={}", userId, normalized, operatorId);
        }

        // 返回与 listUsers 同形状的 UserListVO
        UserListVO vo = new UserListVO();
        vo.setUserId(user.getId());
        vo.setUserNo(user.getUserNo());
        vo.setOpenId(user.getOpenId());
        vo.setNickname(user.getNickname());
        vo.setRealName(user.getRealName());
        vo.setMobile(user.getMobile());
        vo.setRoleType(user.getRoleType());
        vo.setStatus(user.getStatus());
        vo.setBindMobile(user.getBindMobile());
        vo.setCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().format(FMT) : null);
        return vo;
    }

    @Override
    @Transactional
    public CreateAdoptionOrderVO createAdoptionOrder(CreateAdoptionOrderReq req) {
        Long operatorId = StpUtil.getLoginIdAsLong();

        // 校验地块存在
        Plot plot = plotMapper.selectById(req.getPlotId());
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + req.getPlotId());
        }

        AdoptionOrder order = new AdoptionOrder();
        order.setOrderNo(bizDefaults.getOrderNoPrefix() + IdUtil.getSnowflakeNextIdStr());
        order.setPlotId(req.getPlotId());
        order.setCropBatchId(req.getCropBatchId());
        order.setUserId(req.getUserId());
        order.setAdoptionType(req.getAdoptionType() != null ? req.getAdoptionType() : "plot_crop");
        order.setOrderStatus("pending");
        order.setStartAt(LocalDateTime.parse(req.getStartAt(), FMT));
        order.setEndAt(LocalDateTime.parse(req.getEndAt(), FMT));
        order.setVisibilityLevel(req.getVisibilityLevel() != null ? req.getVisibilityLevel() : "full");
        order.setOperationLevel(req.getOperationLevel() != null ? req.getOperationLevel() : "request_only");
        order.setPayableAmount(req.getPayableAmount());
        order.setPayStatus("unpaid");
        order.setRemark(req.getRemark());
        order.setCreatedBy(operatorId);
        orderMapper.insert(order);

        log.info("Admin created adoption order: orderId={}, orderNo={}, by={}", order.getId(), order.getOrderNo(), operatorId);

        CreateAdoptionOrderVO vo = new CreateAdoptionOrderVO();
        vo.setOrderId(order.getId());
        vo.setOrderNo(order.getOrderNo());
        vo.setUserId(order.getUserId());
        vo.setPlotId(order.getPlotId());
        vo.setCropBatchId(order.getCropBatchId());
        vo.setAdoptionType(order.getAdoptionType());
        vo.setStartAt(req.getStartAt());
        vo.setEndAt(req.getEndAt());
        vo.setOrderStatus(order.getOrderStatus());
        vo.setPayStatus(order.getPayStatus());
        vo.setVisibilityLevel(order.getVisibilityLevel());
        vo.setOperationLevel(order.getOperationLevel());
        vo.setCreatedBy(order.getCreatedBy());
        vo.setCreatedAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    @Override
    @Transactional
    public CreateAdoptionCodeVO createAdoptionCode(CreateAdoptionCodeReq req) {
        Long operatorId = StpUtil.getLoginIdAsLong();
        RateLimitProperties.Rule rule = rateLimitProperties.getCreateAdoptionCode();
        String rlKey = "rl:admin:create-code:user:" + operatorId;
        long reqCount = rateLimitService.incrementAndGet(rlKey, rule.getWindowSeconds());
        if (reqCount > rule.getLimit()) {
            rateLimitService.recordHit("createAdoptionCode");
            log.warn("Rate limit hit: scene=createAdoptionCode, key={}, count={}, limit={}, window={}s",
                    rlKey, reqCount, rule.getLimit(), rule.getWindowSeconds());
            throw new BizException(ErrorCode.TOO_MANY_REQUESTS, "生成认养码请求过于频繁，请稍后重试");
        }

        AdoptionOrder order = orderMapper.selectById(req.getOrderId());
        if (order == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "认养订单不存在");
        }

        CreateAdoptionCodeReq.Permissions perms = req.getPermissions();

        AdoptionCode code = new AdoptionCode();
        code.setCode(bizDefaults.getAdoptionCodePrefix() + IdUtil.fastSimpleUUID().substring(0, 8).toUpperCase());
        code.setCodeType(req.getCodeType() != null ? req.getCodeType() : "master");
        code.setOrderId(req.getOrderId());
        code.setPlotId(order.getPlotId());
        code.setCropBatchId(order.getCropBatchId());
        code.setStatus("active");
        code.setValidFrom(LocalDateTime.parse(req.getValidFrom(), FMT));
        code.setValidTo(LocalDateTime.parse(req.getValidTo(), FMT));
        code.setDailyAccessStart(LocalTime.parse(req.getDailyAccessStart() != null ? req.getDailyAccessStart() : "08:00:00"));
        code.setDailyAccessEnd(LocalTime.parse(req.getDailyAccessEnd() != null ? req.getDailyAccessEnd() : "22:00:00"));

        if (perms != null) {
            code.setCanViewLive(Boolean.TRUE.equals(perms.getCanViewLive()) ? 1 : 0);
            code.setCanViewHistory(Boolean.TRUE.equals(perms.getCanViewHistory()) ? 1 : 0);
            code.setHistoryDays(perms.getHistoryDays() != null ? perms.getHistoryDays() : 7);
            code.setCanViewSensor(Boolean.TRUE.equals(perms.getCanViewSensor()) ? 1 : 0);
            code.setCanOperate(Boolean.TRUE.equals(perms.getCanOperate()) ? 1 : 0);
            code.setMaxDailyOperations(perms.getMaxDailyOperations() != null ? perms.getMaxDailyOperations() : 3);
            code.setShareable(Boolean.TRUE.equals(perms.getShareable()) ? 1 : 0);
            if (perms.getOperationWhitelist() != null) {
                try {
                    code.setOperationWhitelist(new ObjectMapper().writeValueAsString(perms.getOperationWhitelist()));
                } catch (Exception e) {
                    code.setOperationWhitelist("[]");
                }
            } else {
                try {
                    code.setOperationWhitelist(new ObjectMapper().writeValueAsString(bizDefaults.getDefaultOperationWhitelist()));
                } catch (Exception ignored) {
                    code.setOperationWhitelist("[]");
                }
            }
        } else {
            code.setCanViewLive(1);
            code.setCanViewHistory(1);
            code.setHistoryDays(7);
            code.setCanViewSensor(1);
            code.setCanOperate(1);
            try {
                code.setOperationWhitelist(new ObjectMapper().writeValueAsString(bizDefaults.getDefaultOperationWhitelist()));
            } catch (Exception ignored) {
                code.setOperationWhitelist("[]");
            }
            code.setMaxDailyOperations(3);
            code.setShareable(0);
        }
        codeMapper.insert(code);

        log.info("Admin created adoption code: codeId={}, code={}", code.getId(), code.getCode());

        CreateAdoptionCodeVO vo = new CreateAdoptionCodeVO();
        vo.setAdoptionCodeId(code.getId());
        vo.setCode(code.getCode());
        vo.setCodeType(code.getCodeType());
        vo.setOrderId(code.getOrderId());
        vo.setStatus(code.getStatus());
        vo.setValidFrom(req.getValidFrom());
        vo.setValidTo(req.getValidTo());
        vo.setCreatedAt(LocalDateTime.now().format(FMT));

        CreateAdoptionCodeVO.Permissions voPerms = new CreateAdoptionCodeVO.Permissions();
        voPerms.setCanViewLive(code.getCanViewLive() == 1);
        voPerms.setCanViewHistory(code.getCanViewHistory() == 1);
        voPerms.setHistoryDays(code.getHistoryDays());
        voPerms.setCanViewSensor(code.getCanViewSensor() == 1);
        voPerms.setCanOperate(code.getCanOperate() == 1);
        voPerms.setMaxDailyOperations(code.getMaxDailyOperations());
        voPerms.setShareable(code.getShareable() == 1);
        voPerms.setOperationWhitelist(perms != null && perms.getOperationWhitelist() != null ? perms.getOperationWhitelist() : bizDefaults.getDefaultOperationWhitelist());
        vo.setPermissions(voPerms);
        return vo;
    }

    @Override
    public AdoptionCodeDetailVO getCodeDetail(Long codeId) {
        AdoptionCode code = codeMapper.selectById(codeId);
        if (code == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "认养码不存在: codeId=" + codeId);
        }
        AdoptionCodeDetailVO vo = new AdoptionCodeDetailVO();
        vo.setCodeId(code.getId());
        vo.setCode(code.getCode());
        vo.setCodeType(code.getCodeType());
        vo.setOrderId(code.getOrderId());
        vo.setPlotId(code.getPlotId());
        vo.setCropBatchId(code.getCropBatchId());
        vo.setBindUserId(code.getBindUserId());
        vo.setStatus(code.getStatus());
        vo.setValidFrom(code.getValidFrom() != null ? code.getValidFrom().format(FMT) : null);
        vo.setValidTo(code.getValidTo() != null ? code.getValidTo().format(FMT) : null);
        vo.setDailyAccessStart(code.getDailyAccessStart() != null ? code.getDailyAccessStart().toString() : null);
        vo.setDailyAccessEnd(code.getDailyAccessEnd() != null ? code.getDailyAccessEnd().toString() : null);
        vo.setCanViewLive(code.getCanViewLive());
        vo.setCanViewHistory(code.getCanViewHistory());
        vo.setHistoryDays(code.getHistoryDays());
        vo.setCanViewSensor(code.getCanViewSensor());
        vo.setCanOperate(code.getCanOperate());
        vo.setShareable(code.getShareable());
        vo.setMaxDailyOperations(code.getMaxDailyOperations());
        // operationWhitelist 落库是 JSON 字符串, 这里反序列化成 List<String> 省得前端再 parse
        List<String> whitelist = new ArrayList<>();
        if (code.getOperationWhitelist() != null && !code.getOperationWhitelist().isBlank()) {
            try {
                whitelist = objectMapper.readValue(
                        code.getOperationWhitelist(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
            } catch (Exception e) {
                log.warn("Failed to parse operationWhitelist for codeId={}: {}", codeId, e.getMessage());
            }
        }
        vo.setOperationWhitelist(whitelist);
        vo.setCreatedByUserId(code.getCreatedByUserId());
        vo.setCreatedAt(code.getCreatedAt() != null ? code.getCreatedAt().format(FMT) : null);
        vo.setUpdatedAt(code.getUpdatedAt() != null ? code.getUpdatedAt().format(FMT) : null);
        return vo;
    }

    @Override
    @Transactional
    public CreatePlotVO createPlot(CreatePlotReq req) {
        Plot plot = new Plot();
        plot.setPlotNo(req.getPlotNo() != null ? req.getPlotNo() : bizDefaults.getPlotNoPrefix() + IdUtil.fastSimpleUUID().substring(0, 6).toUpperCase());
        plot.setPlotName(req.getPlotName());
        plot.setParentId(req.getParentId());
        // 如果指定了 parentId，自动继承 parent 的 farmId/farmName
        if (req.getParentId() != null) {
            Plot parent = plotMapper.selectById(req.getParentId());
            if (parent != null) {
                plot.setFarmId(parent.getFarmId());
                plot.setFarmName(parent.getFarmName());
            }
        }
        if (plot.getFarmId() == null) {
            plot.setFarmId(req.getFarmId() != null ? req.getFarmId() : bizDefaults.getDefaultFarmId());
        }
        if (plot.getFarmName() == null) {
            plot.setFarmName(req.getFarmName() != null ? req.getFarmName() : bizDefaults.getDefaultFarmName());
        }
        plot.setAreaSize(req.getAreaSize());
        plot.setAreaUnit(req.getAreaUnit());
        plot.setLongitude(req.getLongitude());
        plot.setLatitude(req.getLatitude());
        plot.setIntroText(req.getIntroText());
        plot.setPlotStatus("active");
        plotMapper.insert(plot);

        log.info("Admin created plot: plotId={}, plotNo={}", plot.getId(), plot.getPlotNo());

        CreatePlotVO vo = new CreatePlotVO();
        vo.setPlotId(plot.getId());
        vo.setPlotNo(plot.getPlotNo());
        vo.setPlotName(plot.getPlotName());
        vo.setFarmId(plot.getFarmId());
        vo.setFarmName(plot.getFarmName());
        vo.setAreaSize(req.getAreaSize());
        vo.setAreaUnit(req.getAreaUnit());
        vo.setLongitude(req.getLongitude());
        vo.setLatitude(req.getLatitude());
        vo.setPlotStatus(plot.getPlotStatus());
        vo.setIntroText(plot.getIntroText());
        vo.setCreatedAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    @Override
    public PlotDetailVO getPlotDetail(Long plotId) {
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }
        PlotDetailVO vo = new PlotDetailVO();
        vo.setPlotId(plot.getId());
        vo.setPlotNo(plot.getPlotNo());
        vo.setPlotName(plot.getPlotName());
        vo.setParentId(plot.getParentId());
        if (plot.getParentId() != null) {
            Plot parent = plotMapper.selectById(plot.getParentId());
            vo.setParentName(parent != null ? parent.getPlotName() : null);
        }
        vo.setFarmId(plot.getFarmId());
        vo.setFarmName(plot.getFarmName());
        vo.setAreaSize(plot.getAreaSize());
        vo.setAreaUnit(plot.getAreaUnit());
        vo.setLongitude(plot.getLongitude());
        vo.setLatitude(plot.getLatitude());
        vo.setPlotStatus(plot.getPlotStatus());
        vo.setLiveCoverUrl(plot.getLiveCoverUrl());
        vo.setIntroText(plot.getIntroText());
        vo.setCreatedAt(plot.getCreatedAt() != null ? plot.getCreatedAt().format(FMT) : null);
        vo.setUpdatedAt(plot.getUpdatedAt() != null ? plot.getUpdatedAt().format(FMT) : null);
        return vo;
    }

    private static final Set<String> VALID_PLOT_STATUSES = Set.of("active", "fallow", "inactive");

    @Override
    @Transactional
    public PlotDetailVO updatePlot(Long plotId, UpdatePlotReq req) {
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }
        if (req.getPlotStatus() != null && !VALID_PLOT_STATUSES.contains(req.getPlotStatus())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "不支持的地块状态: " + req.getPlotStatus());
        }
        // 经纬度一致性: 要么都传, 要么都不传
        if ((req.getLongitude() == null) != (req.getLatitude() == null)) {
            throw new BizException(ErrorCode.INVALID_PARAM, "经度和纬度必须同时填写");
        }

        String before = safeJson(plot);

        if (req.getPlotName() != null && !req.getPlotName().isBlank()) {
            plot.setPlotName(req.getPlotName().trim());
        }
        if (req.getAreaSize() != null) plot.setAreaSize(req.getAreaSize());
        if (req.getAreaUnit() != null) plot.setAreaUnit(req.getAreaUnit());
        if (req.getLongitude() != null) plot.setLongitude(req.getLongitude());
        if (req.getLatitude() != null) plot.setLatitude(req.getLatitude());
        if (req.getPlotStatus() != null) plot.setPlotStatus(req.getPlotStatus());
        if (req.getLiveCoverUrl() != null) plot.setLiveCoverUrl(req.getLiveCoverUrl());
        if (req.getIntroText() != null) plot.setIntroText(req.getIntroText());

        plotMapper.updateById(plot);

        // 审计: 复用 device_lifecycle_log 表的 kind="plot" 分类
        auditDeviceChange("plot", plotId, plot.getPlotNo(), plotId,
                "update", "admin update", before, safeJson(plot));

        log.info("Admin updated plot: plotId={}, plotNo={}", plotId, plot.getPlotNo());
        return getPlotDetail(plotId);
    }

    @Override
    @Transactional
    public BindCameraVO bindCamera(Long plotId, BindCameraReq req) {
        // 校验地块存在
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }

        // 防重复绑定（同一 deviceNo 不能绑两次）
        String deviceNo = req.getDeviceNo() != null ? req.getDeviceNo() : deviceNoProperties.getCameraPrefix() + IdUtil.fastSimpleUUID().substring(0, deviceNoProperties.getRandomSuffixLength()).toUpperCase();
        Long existCount = cameraMapper.selectCount(
                new LambdaQueryWrapper<CameraDevice>().eq(CameraDevice::getDeviceNo, deviceNo));
        if (existCount > 0) {
            throw new BizException(ErrorCode.INVALID_PARAM, "该摄像头编号已被绑定: " + deviceNo);
        }

        String streamApp = req.getStreamApp() != null ? req.getStreamApp() : mediaServerProperties.getLiveApp();
        String streamName = req.getStreamName() != null ? req.getStreamName() : deviceNo;

        CameraDevice camera = new CameraDevice();
        camera.setDeviceNo(deviceNo);
        camera.setCameraName(req.getCameraName());
        camera.setPlotId(plotId);
        camera.setStreamProtocol(req.getStreamProtocol());
        camera.setPlaybackEnabled(Boolean.TRUE.equals(req.getPlaybackEnabled()) ? 1 : 0);
        camera.setPtzEnabled(0);
        camera.setMicEnabled(0);
        camera.setNetworkStatus("offline");
        camera.setDeviceStatus("registered");
        camera.setStreamApp(streamApp);
        camera.setStreamName(streamName);
        camera.setRtmpPushUrl(req.getRtmpPushUrl());
        cameraMapper.insert(camera);
        log.info("Admin bound camera: plotId={}, cameraId={}, deviceNo={}", plotId, camera.getId(), deviceNo);

        BindCameraVO vo = new BindCameraVO();
        vo.setPlotId(plotId);
        vo.setCameraId(camera.getId());
        vo.setDeviceNo(camera.getDeviceNo());
        vo.setCameraName(camera.getCameraName());
        vo.setRtmpPushUrl(mediaServerProperties.getRtmpBase() + "/" + streamApp + "/" + streamName);
        vo.setBindSuccess(true);
        vo.setDeviceStatus(camera.getDeviceStatus());
        vo.setNetworkStatus(camera.getNetworkStatus());
        vo.setBoundAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    @Override
    @Transactional
    public BindActuatorVO bindActuator(Long plotId, BindActuatorReq req) {
        // 校验地块存在
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }

        // 防重复绑定（同一 deviceNo 不能绑两次）
        String deviceNo = req.getDeviceNo() != null ? req.getDeviceNo() : deviceNoProperties.getActuatorPrefix() + IdUtil.fastSimpleUUID().substring(0, deviceNoProperties.getRandomSuffixLength()).toUpperCase();
        Long existCount = actuatorMapper.selectCount(
                new LambdaQueryWrapper<ActuatorDevice>().eq(ActuatorDevice::getDeviceNo, deviceNo));
        if (existCount > 0) {
            throw new BizException(ErrorCode.INVALID_PARAM, "该设备编号已被绑定: " + deviceNo);
        }

        // 强约束：同地块同类执行器（尤其浇水）默认只能绑定 1 个；如需更换，必须指定 replaceDeviceId
        if (req.getDeviceType() != null && SINGLETON_ACTUATOR_TYPES.contains(req.getDeviceType())) {
            ActuatorDevice existing = actuatorMapper.selectOne(
                    new LambdaQueryWrapper<ActuatorDevice>()
                            .eq(ActuatorDevice::getPlotId, plotId)
                            .eq(ActuatorDevice::getDeviceType, req.getDeviceType())
                            .last("LIMIT 1"));
            if (existing != null) {
                if (req.getReplaceDeviceId() == null) {
                    throw new BizException(ErrorCode.INVALID_PARAM,
                            "该地块已绑定同类设备(" + req.getDeviceType() + "): " + existing.getDeviceNo()
                                    + "，如需更换请传 replaceDeviceId");
                }
                if (!existing.getId().equals(req.getReplaceDeviceId())) {
                    throw new BizException(ErrorCode.INVALID_PARAM,
                            "replaceDeviceId 必须指向当前已绑定的同类设备: " + existing.getId());
                }
                // 先停用旧设备（软删除 + 审计）
                retireActuatorInternal(existing.getId(), req.getReplaceReason() != null ? req.getReplaceReason() : "replace");
            }
        }

        ActuatorDevice device = new ActuatorDevice();
        device.setDeviceNo(deviceNo);
        device.setDeviceName(req.getDeviceName());
        device.setPlotId(plotId);
        device.setDeviceType(req.getDeviceType());
        device.setDeviceStatus("registered");
        device.setEdgeNodeNo(req.getEdgeNodeNo());
        actuatorMapper.insert(device);

        // 初始化设备锁
        DeviceLock lock = new DeviceLock();
        lock.setDeviceId(device.getId());
        lock.setLockStatus("free");
        deviceLockMapper.insert(lock);

        log.info("Admin bound actuator: plotId={}, deviceId={}, deviceNo={}", plotId, device.getId(), deviceNo);

        BindActuatorVO vo = new BindActuatorVO();
        vo.setPlotId(plotId);
        vo.setDeviceId(device.getId());
        vo.setDeviceName(device.getDeviceName());
        vo.setDeviceType(device.getDeviceType());
        vo.setBindSuccess(true);
        vo.setStatus("idle");
        vo.setBoundAt(LocalDateTime.now().format(FMT));

        // 审计：bind
        auditDeviceChange("actuator", device.getId(), device.getDeviceNo(), plotId,
                "bind", "bind", null, safeJson(device));
        return vo;
    }

    @Override
    @Transactional
    public BindSensorVO bindSensor(Long plotId, BindSensorReq req) {
        // 校验地块存在
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }

        // 校验设备编号不重复
        String deviceNo = req.getDeviceNo() != null ? req.getDeviceNo() : deviceNoProperties.getSensorPrefix() + IdUtil.fastSimpleUUID().substring(0, deviceNoProperties.getRandomSuffixLength()).toUpperCase();
        Long existCount = sensorDeviceMapper.selectCount(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getDeviceNo, deviceNo));
        if (existCount > 0) {
            throw new BizException(ErrorCode.INVALID_PARAM, "传感器设备编号已存在: " + deviceNo);
        }

        SensorDevice sensor = new SensorDevice();
        sensor.setDeviceNo(deviceNo);
        sensor.setSensorName(req.getSensorName());
        sensor.setPlotId(plotId);
        sensor.setSensorType(req.getSensorType());
        sensor.setCategory(req.getCategory() != null ? req.getCategory() : "soil");
        sensor.setUnit(req.getUnit() != null ? req.getUnit() : "");
        sensor.setStatus("registered");
        sensorDeviceMapper.insert(sensor);

        log.info("Admin bound sensor: plotId={}, sensorId={}, type={}", plotId, sensor.getId(), sensor.getSensorType());

        BindSensorVO vo = new BindSensorVO();
        vo.setPlotId(plotId);
        vo.setSensorId(sensor.getId());
        vo.setDeviceNo(sensor.getDeviceNo());
        vo.setSensorName(sensor.getSensorName());
        vo.setSensorType(sensor.getSensorType());
        vo.setUnit(sensor.getUnit());
        vo.setCategory(sensor.getCategory());
        vo.setMqttTopic(mqttProperties.getTelemetryTopicPrefix() + sensor.getDeviceNo());
        vo.setBindSuccess(true);
        vo.setStatus("registered");
        vo.setBoundAt(LocalDateTime.now().format(FMT));

        // 审计：bind
        auditDeviceChange("sensor", sensor.getId(), sensor.getDeviceNo(), plotId,
                "bind", "bind", null, safeJson(sensor));
        return vo;
    }

    @Override
    @Transactional
    public void retireActuatorDevice(Long deviceId, RetireDeviceReq req) {
        retireActuatorInternal(deviceId, req != null ? req.getReason() : "");
    }

    @Override
    @Transactional
    public void retireSensorDevice(Long sensorId, RetireDeviceReq req) {
        SensorDevice sensor = sensorDeviceMapper.selectById(sensorId);
        if (sensor == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "传感器不存在: sensorId=" + sensorId);
        }
        String before = safeJson(sensor);
        // 软删除 + 标记状态
        sensor.setStatus("retired");
        sensorDeviceMapper.updateById(sensor);
        sensorDeviceMapper.deleteById(sensorId);
        auditDeviceChange("sensor", sensorId, sensor.getDeviceNo(), sensor.getPlotId(),
                "retire", req != null ? req.getReason() : "", before, safeJson(sensor));
    }

    private void retireActuatorInternal(Long deviceId, String reason) {
        ActuatorDevice device = actuatorMapper.selectById(deviceId);
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "设备不存在: deviceId=" + deviceId);
        }

        // 防误删：存在未终态任务则禁止停用
        Long blocking = taskMapper.selectCount(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getDeviceId, deviceId)
                        .in(OperationTask::getTaskStatus, "pending", "queued", "running"));
        if (blocking != null && blocking > 0) {
            throw new BizException(ErrorCode.INVALID_PARAM, "设备存在未完成任务，禁止停用");
        }

        String before = safeJson(device);
        device.setDeviceStatus("retired");
        device.setNetworkStatus("offline");
        actuatorMapper.updateById(device);
        actuatorMapper.deleteById(deviceId); // TableLogic

        auditDeviceChange("actuator", deviceId, device.getDeviceNo(), device.getPlotId(),
                "retire", reason, before, safeJson(device));
    }

    private void auditDeviceChange(String kind, Long deviceId, String deviceNo, Long plotId,
                                   String action, String reason, String beforeJson, String afterJson) {
        try {
            DeviceLifecycleLog logRow = new DeviceLifecycleLog();
            logRow.setDeviceKind(kind);
            logRow.setDeviceId(deviceId);
            logRow.setDeviceNo(deviceNo);
            logRow.setPlotId(plotId);
            logRow.setAction(action);
            logRow.setReason(reason);
            try {
                logRow.setOperatorId(StpUtil.getLoginIdAsLong());
            } catch (Exception ignored) {
                // admin seeder/脚本场景可能没登录态
                logRow.setOperatorId(null);
            }
            logRow.setBeforeJson(beforeJson);
            logRow.setAfterJson(afterJson);
            logRow.setCreatedAt(LocalDateTime.now());
            deviceLifecycleLogMapper.insert(logRow);
        } catch (Exception e) {
            log.warn("auditDeviceChange failed: kind={}, deviceId={}, err={}", kind, deviceId, e.getMessage());
        }
    }

    private String safeJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    @Transactional
    public BindScreenVO bindScreen(Long plotId, BindScreenReq req) {
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }

        String deviceNo = req.getDeviceNo() != null ? req.getDeviceNo() : deviceNoProperties.getScreenPrefix() + IdUtil.fastSimpleUUID().substring(0, deviceNoProperties.getRandomSuffixLength()).toUpperCase();
        Long existCount = screenDeviceMapper.selectCount(
                new LambdaQueryWrapper<ScreenDevice>().eq(ScreenDevice::getDeviceNo, deviceNo));
        if (existCount > 0) {
            throw new BizException(ErrorCode.INVALID_PARAM, "大屏设备编号已存在: " + deviceNo);
        }

        String screenToken = generateScreenToken(deviceNo);

        ScreenDevice screen = new ScreenDevice();
        screen.setDeviceNo(deviceNo);
        screen.setScreenName(req.getScreenName());
        screen.setPlotId(plotId);
        screen.setScreenToken(screenToken);
        screen.setLayoutConfig(req.getLayoutConfig());
        screen.setStatus("offline");
        screenDeviceMapper.insert(screen);

        log.info("Admin bound screen: plotId={}, screenId={}, deviceNo={}", plotId, screen.getId(), deviceNo);

        BindScreenVO vo = new BindScreenVO();
        vo.setPlotId(plotId);
        vo.setScreenId(screen.getId());
        vo.setDeviceNo(screen.getDeviceNo());
        vo.setScreenName(screen.getScreenName());
        vo.setScreenToken(screenToken);
        vo.setBindSuccess(true);
        vo.setBoundAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    @Override
    @Transactional
    public CreateCropBatchVO createCropBatch(Long plotId, CreateCropBatchReq req) {
        // 校验地块存在
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }

        CropBatch batch = new CropBatch();
        batch.setBatchNo(bizDefaults.getCropBatchNoPrefix() + IdUtil.fastSimpleUUID().substring(0, 8).toUpperCase());
        batch.setPlotId(plotId);
        batch.setCropName(req.getCropName());
        batch.setVarietyName(req.getVarietyName());
        batch.setGrowthStage(req.getGrowthStage() != null ? req.getGrowthStage() : "seedling");
        batch.setBatchStatus("active");
        if (req.getSowingAt() != null) {
            batch.setSowingAt(LocalDateTime.parse(req.getSowingAt(), FMT));
        }
        if (req.getExpectedHarvestAt() != null) {
            batch.setExpectedHarvestAt(LocalDateTime.parse(req.getExpectedHarvestAt(), FMT));
        }
        cropBatchMapper.insert(batch);

        log.info("Admin created crop batch: plotId={}, batchId={}, crop={}", plotId, batch.getId(), batch.getCropName());

        CreateCropBatchVO vo = new CreateCropBatchVO();
        vo.setCropBatchId(batch.getId());
        vo.setBatchNo(batch.getBatchNo());
        vo.setPlotId(plotId);
        vo.setCropName(batch.getCropName());
        vo.setVarietyName(batch.getVarietyName());
        vo.setGrowthStage(batch.getGrowthStage());
        vo.setBatchStatus(batch.getBatchStatus());
        vo.setSowingAt(req.getSowingAt());
        vo.setExpectedHarvestAt(req.getExpectedHarvestAt());
        vo.setCreatedAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    @Override
    public ActuatorDeviceDetailVO getActuatorDevice(Long deviceId) {
        ActuatorDevice device = actuatorMapper.selectById(deviceId);
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "设备不存在");
        }

        DeviceLock lock = deviceLockMapper.selectOne(
                new LambdaQueryWrapper<DeviceLock>().eq(DeviceLock::getDeviceId, deviceId));

        ActuatorDeviceDetailVO vo = new ActuatorDeviceDetailVO();
        vo.setDeviceId(device.getId());
        vo.setDeviceNo(device.getDeviceNo());
        vo.setDeviceName(device.getDeviceName());
        vo.setPlotId(device.getPlotId());
        vo.setDeviceType(device.getDeviceType());
        vo.setDeviceStatus(device.getDeviceStatus());
        vo.setLockStatus(lock != null ? lock.getLockStatus() : "unknown");
        vo.setCurrentTaskId(lock != null ? lock.getCurrentTaskId() : null);
        if (lock != null) {
            vo.setLockedAt(lock.getLockedAt() != null ? lock.getLockedAt().format(FMT) : null);
            vo.setLockExpireAt(lock.getLockExpireAt() != null ? lock.getLockExpireAt().format(FMT) : null);
        }
        return vo;
    }

    @Override
    @Transactional
    public UnlockDeviceVO unlockDevice(Long deviceId, UnlockDeviceReq req) {
        Long operatorId = StpUtil.getLoginIdAsLong();
        DeviceLock lock = deviceLockMapper.selectOne(
                new LambdaQueryWrapper<DeviceLock>().eq(DeviceLock::getDeviceId, deviceId));
        if (lock == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "设备锁不存在");
        }
        Long previousTaskId = lock.getCurrentTaskId();
        lock.setLockStatus("free");
        lock.setCurrentTaskId(null);
        lock.setLockOwner(null);
        lock.setLockedAt(null);
        lock.setLockExpireAt(null);
        deviceLockMapper.updateById(lock);
        log.info("Admin force-unlocked device: deviceId={}, reason={}, by={}", deviceId, req != null ? req.getReason() : "", operatorId);

        UnlockDeviceVO vo = new UnlockDeviceVO();
        vo.setDeviceId(deviceId);
        vo.setUnlockSuccess(true);
        vo.setPreviousLockTaskId(previousTaskId);
        vo.setLockStatus("free");
        vo.setReleasedAt(LocalDateTime.now().format(FMT));
        vo.setOperatorId(operatorId);
        return vo;
    }

    @Override
    @Transactional
    public TakeoverTaskVO takeoverTask(Long taskId, TakeoverTaskReq req) {
        Long operatorId = StpUtil.getLoginIdAsLong();
        OperationTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        }
        int newPriority = (req != null && req.getNewPriority() != null) ? req.getNewPriority() : 1;
        log.info("Admin takeover task: taskId={}, currentStatus={}, reason={}, by={}", taskId, task.getTaskStatus(), req != null ? req.getReason() : "", operatorId);
        task.setPriority(newPriority);
        taskMapper.updateById(task);

        TakeoverTaskVO vo = new TakeoverTaskVO();
        vo.setTaskId(task.getId());
        vo.setTaskNo(task.getTaskNo());
        vo.setTakeoverSuccess(true);
        vo.setTaskStatus(task.getTaskStatus());
        vo.setPriority(newPriority);
        vo.setTakenOverBy(operatorId);
        vo.setTakenOverAt(LocalDateTime.now().format(FMT));
        vo.setMessage("任务已由管理员接管");
        return vo;
    }

    // ===== 列表查询 =====

    @Override
    public PageResult<UserListVO> listUsers(int pageNo, int pageSize, String roleType, String keyword) {
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<>();
        if (roleType != null && !roleType.isBlank()) {
            qw.eq(User::getRoleType, roleType);
        }
        if (keyword != null && !keyword.isBlank()) {
            qw.and(w -> w.like(User::getNickname, keyword)
                    .or().like(User::getRealName, keyword)
                    .or().like(User::getMobile, keyword)
                    .or().like(User::getUserNo, keyword));
        }
        qw.orderByDesc(User::getCreatedAt);
        Page<User> page = userMapper.selectPage(new Page<>(pageNo, pageSize), qw);
        List<UserListVO> list = page.getRecords().stream().map(u -> {
            UserListVO vo = new UserListVO();
            vo.setUserId(u.getId());
            vo.setUserNo(u.getUserNo());
            vo.setOpenId(u.getOpenId());
            vo.setNickname(u.getNickname());
            vo.setRealName(u.getRealName());
            vo.setMobile(u.getMobile());
            vo.setRoleType(u.getRoleType());
            vo.setStatus(u.getStatus());
            vo.setBindMobile(u.getBindMobile());
            vo.setCreatedAt(u.getCreatedAt() != null ? u.getCreatedAt().format(FMT) : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    public PageResult<OrderListVO> listOrders(int pageNo, int pageSize, String orderStatus, Long userId) {
        LambdaQueryWrapper<AdoptionOrder> qw = new LambdaQueryWrapper<>();
        if (orderStatus != null && !orderStatus.isBlank()) {
            qw.eq(AdoptionOrder::getOrderStatus, orderStatus);
        }
        if (userId != null) {
            qw.eq(AdoptionOrder::getUserId, userId);
        }
        qw.orderByDesc(AdoptionOrder::getCreatedAt);
        Page<AdoptionOrder> page = orderMapper.selectPage(new Page<>(pageNo, pageSize), qw);
        List<OrderListVO> list = page.getRecords().stream().map(o -> {
            OrderListVO vo = new OrderListVO();
            vo.setOrderId(o.getId());
            vo.setOrderNo(o.getOrderNo());
            vo.setUserId(o.getUserId());
            vo.setPlotId(o.getPlotId());
            vo.setCropBatchId(o.getCropBatchId());
            vo.setAdoptionType(o.getAdoptionType());
            vo.setOrderStatus(o.getOrderStatus());
            vo.setPayStatus(o.getPayStatus());
            vo.setPayableAmount(o.getPayableAmount());
            vo.setVisibilityLevel(o.getVisibilityLevel());
            vo.setOperationLevel(o.getOperationLevel());
            vo.setRemark(o.getRemark());
            vo.setCreatedBy(o.getCreatedBy());
            vo.setStartAt(o.getStartAt() != null ? o.getStartAt().format(FMT) : null);
            vo.setEndAt(o.getEndAt() != null ? o.getEndAt().format(FMT) : null);
            vo.setCreatedAt(o.getCreatedAt() != null ? o.getCreatedAt().format(FMT) : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    public PageResult<CodeListVO> listCodes(int pageNo, int pageSize, Long orderId, String status) {
        LambdaQueryWrapper<AdoptionCode> qw = new LambdaQueryWrapper<>();
        if (orderId != null) {
            qw.eq(AdoptionCode::getOrderId, orderId);
        }
        if (status != null && !status.isBlank()) {
            qw.eq(AdoptionCode::getStatus, status);
        }
        qw.orderByDesc(AdoptionCode::getCreatedAt);
        Page<AdoptionCode> page = codeMapper.selectPage(new Page<>(pageNo, pageSize), qw);
        List<CodeListVO> list = page.getRecords().stream().map(c -> {
            CodeListVO vo = new CodeListVO();
            vo.setCodeId(c.getId());
            vo.setCode(c.getCode());
            vo.setCodeType(c.getCodeType());
            vo.setOrderId(c.getOrderId());
            vo.setPlotId(c.getPlotId());
            vo.setCropBatchId(c.getCropBatchId());
            vo.setBindUserId(c.getBindUserId());
            vo.setStatus(c.getStatus());
            vo.setValidFrom(c.getValidFrom() != null ? c.getValidFrom().format(FMT) : null);
            vo.setValidTo(c.getValidTo() != null ? c.getValidTo().format(FMT) : null);
            vo.setCanViewLive(c.getCanViewLive());
            vo.setCanOperate(c.getCanOperate());
            vo.setShareable(c.getShareable());
            vo.setCreatedAt(c.getCreatedAt() != null ? c.getCreatedAt().format(FMT) : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    public PageResult<PlotListVO> listPlots(int pageNo, int pageSize, String plotStatus, Long parentId) {
        LambdaQueryWrapper<Plot> qw = new LambdaQueryWrapper<>();
        if (plotStatus != null && !plotStatus.isBlank()) {
            qw.eq(Plot::getPlotStatus, plotStatus);
        }
        if (parentId != null) {
            qw.eq(Plot::getParentId, parentId);
        }
        // 大棚排前面，同级按 id 正序
        qw.orderByAsc(Plot::getParentId).orderByAsc(Plot::getId);
        Page<Plot> page = plotMapper.selectPage(new Page<>(pageNo, pageSize), qw);

        // 批量查 parent 名称
        Set<Long> parentIds = page.getRecords().stream()
                .map(Plot::getParentId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> parentNameMap = parentIds.isEmpty() ? Map.of()
                : plotMapper.selectBatchIds(parentIds).stream()
                        .collect(Collectors.toMap(Plot::getId, Plot::getPlotName));

        List<PlotListVO> list = page.getRecords().stream().map(p -> {
            PlotListVO vo = new PlotListVO();
            vo.setPlotId(p.getId());
            vo.setPlotNo(p.getPlotNo());
            vo.setPlotName(p.getPlotName());
            vo.setParentId(p.getParentId());
            vo.setParentName(p.getParentId() != null ? parentNameMap.get(p.getParentId()) : null);
            vo.setFarmId(p.getFarmId());
            vo.setFarmName(p.getFarmName());
            vo.setAreaSize(p.getAreaSize());
            vo.setAreaUnit(p.getAreaUnit());
            vo.setPlotStatus(p.getPlotStatus());
            vo.setCreatedAt(p.getCreatedAt() != null ? p.getCreatedAt().format(FMT) : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    public PageResult<DeviceListVO> listDevices(int pageNo, int pageSize, Long plotId, String deviceStatus) {
        LambdaQueryWrapper<ActuatorDevice> qw = new LambdaQueryWrapper<>();
        if (plotId != null) {
            qw.eq(ActuatorDevice::getPlotId, plotId);
        }
        if (deviceStatus != null && !deviceStatus.isBlank()) {
            qw.eq(ActuatorDevice::getDeviceStatus, deviceStatus);
        }
        qw.orderByDesc(ActuatorDevice::getCreatedAt);
        Page<ActuatorDevice> page = actuatorMapper.selectPage(new Page<>(pageNo, pageSize), qw);

        // ---- 批量查 plot 名 + device 锁, 避免 N+1 ----
        Set<Long> plotIds = page.getRecords().stream()
                .map(ActuatorDevice::getPlotId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> plotNameMap = plotIds.isEmpty() ? Map.of()
                : plotMapper.selectBatchIds(plotIds).stream()
                        .collect(Collectors.toMap(Plot::getId, Plot::getPlotName));

        Set<Long> deviceIds = page.getRecords().stream()
                .map(ActuatorDevice::getId).collect(Collectors.toSet());
        Map<Long, DeviceLock> lockMap = deviceIds.isEmpty() ? Map.of()
                : deviceLockMapper.selectList(
                        new LambdaQueryWrapper<DeviceLock>().in(DeviceLock::getDeviceId, deviceIds))
                        .stream().collect(Collectors.toMap(DeviceLock::getDeviceId, l -> l, (a, b) -> a));

        List<DeviceListVO> list = page.getRecords().stream().map(d -> {
            DeviceListVO vo = new DeviceListVO();
            vo.setDeviceId(d.getId());
            vo.setDeviceNo(d.getDeviceNo());
            vo.setDeviceName(d.getDeviceName());
            vo.setPlotId(d.getPlotId());
            vo.setPlotName(d.getPlotId() != null ? plotNameMap.get(d.getPlotId()) : null);
            vo.setDeviceType(d.getDeviceType());
            vo.setDeviceStatus(d.getDeviceStatus());
            vo.setNetworkStatus(d.getNetworkStatus());
            vo.setCreatedAt(d.getCreatedAt() != null ? d.getCreatedAt().format(FMT) : null);
            vo.setLastHeartbeatAt(d.getLastHeartbeatAt() != null ? d.getLastHeartbeatAt().format(FMT) : null);
            if (d.getLastHeartbeatAt() != null) {
                long age = java.time.Duration.between(d.getLastHeartbeatAt(), LocalDateTime.now()).getSeconds();
                vo.setHeartbeatAgeSeconds(Math.max(age, 0L));
            } else {
                vo.setHeartbeatAgeSeconds(null);
            }
            DeviceLock lock = lockMap.get(d.getId());
            vo.setLockStatus(lock != null ? lock.getLockStatus() : "unknown");
            vo.setCurrentTaskId(lock != null ? lock.getCurrentTaskId() : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    public PageResult<TaskListVO> listTasks(int pageNo, int pageSize, Long plotId, String taskStatus) {
        LambdaQueryWrapper<OperationTask> qw = new LambdaQueryWrapper<>();
        if (plotId != null) {
            qw.eq(OperationTask::getPlotId, plotId);
        }
        if (taskStatus != null && !taskStatus.isBlank()) {
            qw.eq(OperationTask::getTaskStatus, taskStatus);
        }
        qw.orderByDesc(OperationTask::getCreatedAt);
        Page<OperationTask> page = taskMapper.selectPage(new Page<>(pageNo, pageSize), qw);

        // ---- 批量查 user/plot/device, 避免 N+1 ----
        Set<Long> userIds = page.getRecords().stream()
                .map(OperationTask::getRequestUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> userNameMap = userIds.isEmpty() ? Map.of()
                : userMapper.selectBatchIds(userIds).stream()
                        .collect(Collectors.toMap(User::getId,
                                u -> u.getNickname() != null ? u.getNickname() :
                                     (u.getRealName() != null ? u.getRealName() : u.getUserNo())));

        Set<Long> plotIds = page.getRecords().stream()
                .map(OperationTask::getPlotId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> plotNameMap = plotIds.isEmpty() ? Map.of()
                : plotMapper.selectBatchIds(plotIds).stream()
                        .collect(Collectors.toMap(Plot::getId, Plot::getPlotName));

        Set<Long> deviceIds = page.getRecords().stream()
                .map(OperationTask::getDeviceId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, ActuatorDevice> deviceMap = deviceIds.isEmpty() ? Map.of()
                : actuatorMapper.selectBatchIds(deviceIds).stream()
                        .collect(Collectors.toMap(ActuatorDevice::getId, d -> d));

        List<TaskListVO> list = page.getRecords().stream().map(t -> {
            TaskListVO vo = new TaskListVO();
            vo.setTaskId(t.getId());
            vo.setTaskNo(t.getTaskNo());
            vo.setRequestUserId(t.getRequestUserId());
            vo.setRequesterName(t.getRequestUserId() != null ? userNameMap.get(t.getRequestUserId()) : null);
            vo.setPlotId(t.getPlotId());
            vo.setPlotName(t.getPlotId() != null ? plotNameMap.get(t.getPlotId()) : null);
            vo.setDeviceId(t.getDeviceId());
            ActuatorDevice dev = t.getDeviceId() != null ? deviceMap.get(t.getDeviceId()) : null;
            if (dev != null) {
                vo.setDeviceNo(dev.getDeviceNo());
                vo.setDeviceName(dev.getDeviceName());
            }
            vo.setActionType(t.getActionType());
            vo.setPriority(t.getPriority());
            vo.setTaskStatus(t.getTaskStatus());
            vo.setDeviceExecutionState(t.getDeviceExecutionState());
            vo.setFailReason(t.getFailReason());
            vo.setCreatedAt(t.getCreatedAt() != null ? t.getCreatedAt().format(FMT) : null);
            vo.setFinishedAt(t.getFinishedAt() != null ? t.getFinishedAt().format(FMT) : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    @Transactional
    public OperatorPlotBindingVO bindOperatorPlot(Long operatorUserId, Long plotId, BindOperatorPlotReq req) {
        User user = userMapper.selectById(operatorUserId);
        if (user == null || user.getDeleted() == 1) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在");
        }
        if (!"operator".equalsIgnoreCase(user.getRoleType())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "目标用户不是operator角色");
        }
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null || plot.getDeleted() == 1) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在");
        }

        OperatorPlotBinding existed = operatorPlotBindingMapper.selectOne(
                new LambdaQueryWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getOperatorUserId, operatorUserId)
                        .eq(OperatorPlotBinding::getPlotId, plotId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .last("LIMIT 1"));
        Long adminId = StpUtil.getLoginIdAsLong();
        int primary = req != null && req.getIsPrimary() != null ? req.getIsPrimary() : 0;
        if (existed != null) {
            // 允许“主责切换”：对已存在绑定，若传 isPrimary=1 则将其设为主责，并清理同 plot 其它主责
            if (primary == 1 && (existed.getIsPrimary() == null || existed.getIsPrimary() != 1)) {
                operatorPlotBindingMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getPlotId, plotId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .set(OperatorPlotBinding::getIsPrimary, 0)
                        .set(OperatorPlotBinding::getUpdatedBy, adminId));
                operatorPlotBindingMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getId, existed.getId())
                        .set(OperatorPlotBinding::getIsPrimary, 1)
                        .set(OperatorPlotBinding::getUpdatedBy, adminId));
                existed.setIsPrimary(1);
            }
            return toOperatorBindingVO(existed);
        }

        if (primary == 1) {
            operatorPlotBindingMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<OperatorPlotBinding>()
                    .eq(OperatorPlotBinding::getPlotId, plotId)
                    .eq(OperatorPlotBinding::getStatus, "active")
                    .set(OperatorPlotBinding::getIsPrimary, 0)
                    .set(OperatorPlotBinding::getUpdatedBy, adminId));
        }

        OperatorPlotBinding b = new OperatorPlotBinding();
        b.setOperatorUserId(operatorUserId);
        b.setPlotId(plotId);
        b.setIsPrimary(primary == 1 ? 1 : 0);
        b.setStatus("active");
        b.setCreatedBy(adminId);
        b.setUpdatedBy(adminId);
        operatorPlotBindingMapper.insert(b);
        return toOperatorBindingVO(b);
    }

    @Override
    @Transactional
    public void unbindOperatorPlot(Long operatorUserId, Long plotId) {
        Long adminId = StpUtil.getLoginIdAsLong();
        int updated = operatorPlotBindingMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<OperatorPlotBinding>()
                .eq(OperatorPlotBinding::getOperatorUserId, operatorUserId)
                .eq(OperatorPlotBinding::getPlotId, plotId)
                .eq(OperatorPlotBinding::getStatus, "active")
                .set(OperatorPlotBinding::getStatus, "inactive")
                .set(OperatorPlotBinding::getDeleted, 1)
                .set(OperatorPlotBinding::getUpdatedBy, adminId));
        if (updated == 0) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "未找到有效绑定关系");
        }
    }

    @Override
    public PageResult<OperatorPlotBindingVO> listOperatorPlots(Long operatorUserId, int pageNo, int pageSize) {
        Page<OperatorPlotBinding> page = operatorPlotBindingMapper.selectPage(
                new Page<>(pageNo, pageSize),
                new LambdaQueryWrapper<OperatorPlotBinding>()
                        .eq(OperatorPlotBinding::getOperatorUserId, operatorUserId)
                        .eq(OperatorPlotBinding::getStatus, "active")
                        .orderByDesc(OperatorPlotBinding::getIsPrimary)
                        .orderByDesc(OperatorPlotBinding::getCreatedAt));
        List<OperatorPlotBindingVO> list = page.getRecords().stream()
                .map(this::toOperatorBindingVO)
                .collect(Collectors.toList());
        return PageResult.from(page, list);
    }

    private OperatorPlotBindingVO toOperatorBindingVO(OperatorPlotBinding b) {
        OperatorPlotBindingVO vo = new OperatorPlotBindingVO();
        vo.setBindingId(b.getId());
        vo.setOperatorUserId(b.getOperatorUserId());
        vo.setPlotId(b.getPlotId());
        vo.setIsPrimary(b.getIsPrimary());
        vo.setStatus(b.getStatus());
        return vo;
    }

    @Override
    public PageResult<ScreenListVO> listScreens(int pageNo, int pageSize, Long plotId) {
        LambdaQueryWrapper<ScreenDevice> qw = new LambdaQueryWrapper<>();
        if (plotId != null) {
            qw.eq(ScreenDevice::getPlotId, plotId);
        }
        qw.orderByDesc(ScreenDevice::getCreatedAt);
        Page<ScreenDevice> page = screenDeviceMapper.selectPage(new Page<>(pageNo, pageSize), qw);
        List<ScreenListVO> list = page.getRecords().stream().map(s -> {
            ScreenListVO vo = new ScreenListVO();
            vo.setScreenId(s.getId());
            vo.setDeviceNo(s.getDeviceNo());
            vo.setScreenName(s.getScreenName());
            vo.setPlotId(s.getPlotId());
            // 查地块名
            Plot plot = plotMapper.selectById(s.getPlotId());
            vo.setPlotName(plot != null ? plot.getPlotName() : "未知地块");
            vo.setScreenToken(s.getScreenToken());
            vo.setStatus(s.getStatus());
            vo.setLastPingAt(s.getLastPingAt() != null ? s.getLastPingAt().format(FMT) : null);
            vo.setCreatedAt(s.getCreatedAt() != null ? s.getCreatedAt().format(FMT) : null);
            return vo;
        }).toList();
        return PageResult.from(page, list);
    }

    @Override
    @Transactional
    public void deleteScreen(Long screenId) {
        ScreenDevice screen = screenDeviceMapper.selectById(screenId);
        if (screen == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "大屏不存在: screenId=" + screenId);
        }
        screenDeviceMapper.deleteById(screenId);
        log.info("Admin deleted screen: screenId={}, deviceNo={}", screenId, screen.getDeviceNo());
    }

    @Override
    @Transactional
    public BindScreenVO regenerateScreenToken(Long screenId) {
        ScreenDevice screen = screenDeviceMapper.selectById(screenId);
        if (screen == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "大屏不存在: screenId=" + screenId);
        }
        String newToken = generateScreenToken(screen.getDeviceNo());
        screen.setScreenToken(newToken);
        screenDeviceMapper.updateById(screen);
        log.info("Admin regenerated screen token: screenId={}, deviceNo={}", screenId, screen.getDeviceNo());

        BindScreenVO vo = new BindScreenVO();
        vo.setPlotId(screen.getPlotId());
        vo.setScreenId(screen.getId());
        vo.setDeviceNo(screen.getDeviceNo());
        vo.setScreenName(screen.getScreenName());
        vo.setScreenToken(newToken);
        vo.setBindSuccess(true);
        vo.setBoundAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    /**
     * 生成可读的 screen_token · 格式: tk-{devicenoshort}-{12hex}
     *  · 为什么加前缀: 运维复制粘贴时能一眼识别这是哪块大屏的 token, 少出错
     *  · 为什么 12 位随机: 2¹³² 撞撞可忽, 又不会长到运维输错
     *  · 示例: tk-scrdm01-a1b2c3d4e5f6
     */
    private static String generateScreenToken(String deviceNo) {
        String suffix = deviceNo == null
                ? "unknown"
                : deviceNo.toLowerCase().replace("-", "");
        String shortHex = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return "tk-" + suffix + "-" + shortHex;
    }

    // ===== 状态变更 =====

    private static final Set<String> VALID_ORDER_STATUSES = Set.of("pending", "active", "completed", "cancelled");

    @Override
    @Transactional
    public OrderListVO updateOrderStatus(Long orderId, UpdateOrderStatusReq req) {
        Long operatorId = StpUtil.getLoginIdAsLong();
        AdoptionOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "认养订单不存在");
        }
        if (!VALID_ORDER_STATUSES.contains(req.getOrderStatus())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "不支持的订单状态: " + req.getOrderStatus());
        }
        order.setOrderStatus(req.getOrderStatus());
        if (req.getPayStatus() != null && !req.getPayStatus().isBlank()) {
            order.setPayStatus(req.getPayStatus());
        }
        if (req.getRemark() != null) {
            order.setRemark(req.getRemark());
        }
        orderMapper.updateById(order);
        log.info("Admin updated order status: orderId={}, newStatus={}, by={}", orderId, req.getOrderStatus(), operatorId);

        OrderListVO vo = new OrderListVO();
        vo.setOrderId(order.getId());
        vo.setOrderNo(order.getOrderNo());
        vo.setUserId(order.getUserId());
        vo.setPlotId(order.getPlotId());
        vo.setCropBatchId(order.getCropBatchId());
        vo.setAdoptionType(order.getAdoptionType());
        vo.setOrderStatus(order.getOrderStatus());
        vo.setPayStatus(order.getPayStatus());
        vo.setPayableAmount(order.getPayableAmount());
        vo.setVisibilityLevel(order.getVisibilityLevel());
        vo.setOperationLevel(order.getOperationLevel());
        vo.setRemark(order.getRemark());
        vo.setCreatedBy(order.getCreatedBy());
        vo.setStartAt(order.getStartAt() != null ? order.getStartAt().format(FMT) : null);
        vo.setEndAt(order.getEndAt() != null ? order.getEndAt().format(FMT) : null);
        vo.setCreatedAt(order.getCreatedAt() != null ? order.getCreatedAt().format(FMT) : null);
        return vo;
    }

    @Override
    @Transactional
    public CodeListVO revokeCode(Long codeId, RevokeCodeReq req) {
        Long operatorId = StpUtil.getLoginIdAsLong();
        AdoptionCode code = codeMapper.selectById(codeId);
        if (code == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "认养码不存在");
        }
        if ("revoked".equals(code.getStatus())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "认养码已吊销");
        }
        code.setStatus("revoked");
        codeMapper.updateById(code);
        log.info("Admin revoked code: codeId={}, code={}, reason={}, by={}", codeId, code.getCode(),
                req != null ? req.getReason() : "", operatorId);

        CodeListVO vo = new CodeListVO();
        vo.setCodeId(code.getId());
        vo.setCode(code.getCode());
        vo.setCodeType(code.getCodeType());
        vo.setOrderId(code.getOrderId());
        vo.setPlotId(code.getPlotId());
        vo.setCropBatchId(code.getCropBatchId());
        vo.setBindUserId(code.getBindUserId());
        vo.setStatus(code.getStatus());
        vo.setValidFrom(code.getValidFrom() != null ? code.getValidFrom().format(FMT) : null);
        vo.setValidTo(code.getValidTo() != null ? code.getValidTo().format(FMT) : null);
        vo.setCanViewLive(code.getCanViewLive());
        vo.setCanOperate(code.getCanOperate());
        vo.setShareable(code.getShareable());
        vo.setCreatedAt(code.getCreatedAt() != null ? code.getCreatedAt().format(FMT) : null);
        return vo;
    }

    // ===== 设备数据查看 =====

    @Override
    public DeviceOverviewVO getDeviceOverview() {
        DeviceOverviewVO vo = new DeviceOverviewVO();

        long plotCount = plotMapper.selectCount(new LambdaQueryWrapper<>());
        vo.setTotalPlots((int) plotCount);

        List<DeviceOverviewVO.DeviceGroupStat> stats = new java.util.ArrayList<>();

        // 摄像头统计
        stats.add(buildDeviceStat("camera",
                cameraMapper.selectList(new LambdaQueryWrapper<CameraDevice>())));

        // 传感器统计
        stats.add(buildDeviceStat("sensor",
                sensorDeviceMapper.selectList(new LambdaQueryWrapper<SensorDevice>())));

        // 执行设备统计
        stats.add(buildDeviceStat("actuator",
                actuatorMapper.selectList(new LambdaQueryWrapper<>())));

        // 大屏统计
        stats.add(buildDeviceStat("screen",
                screenDeviceMapper.selectList(new LambdaQueryWrapper<ScreenDevice>())));

        vo.setDeviceStats(stats);
        return vo;
    }

    @Override
    public HardwareAccessInfoVO getHardwareAccessInfo() {
        HardwareAccessInfoVO vo = new HardwareAccessInfoVO();
        vo.setBrokerUrl(mqttProperties.getBrokerUrl());
        vo.setAuthMode(mqttProperties.getAuthMode());
        vo.setTlsEnabled(mqttProperties.getSsl() != null && mqttProperties.getSsl().isEnabled());
        vo.setStrictDeviceIdentity(mqttProperties.isStrictDeviceIdentity());
        vo.setRequireMessageId(mqttProperties.isRequireMessageId());
        vo.setRequireTimestamp(mqttProperties.isRequireTimestamp());
        vo.setReplayWindowSeconds(mqttProperties.getReplayWindowSeconds());
        vo.setCommandTtlSeconds(mqttProperties.getCommandTtlSeconds());
        vo.setTopicPrefixes(Map.of(
                "command", mqttProperties.getCommandTopicPrefix(),
                "callback", mqttProperties.getCallbackTopicPrefix(),
                "telemetry", mqttProperties.getTelemetryTopicPrefix(),
                "heartbeat", mqttProperties.getHeartbeatTopicPrefix()));
        vo.setQos(Map.of(
                "command", mqttProperties.getCommandQos(),
                "callback", mqttProperties.getCallbackQos(),
                "telemetry", mqttProperties.getTelemetryQos(),
                "heartbeat", mqttProperties.getHeartbeatQos()));

        List<HardwareAccessInfoVO.DeviceAccessInfo> devices = new ArrayList<>();
        for (EdgeNode node : edgeNodeMapper.selectList(new LambdaQueryWrapper<>())) {
            devices.add(edgeAccessInfo(node));
        }
        for (SensorDevice sensor : sensorDeviceMapper.selectList(new LambdaQueryWrapper<>())) {
            devices.add(sensorAccessInfo(sensor));
        }
        for (ActuatorDevice actuator : actuatorMapper.selectList(new LambdaQueryWrapper<>())) {
            devices.add(actuatorAccessInfo(actuator));
        }
        for (CameraDevice camera : cameraMapper.selectList(new LambdaQueryWrapper<>())) {
            devices.add(cameraAccessInfo(camera));
        }
        vo.setDevices(devices);
        return vo;
    }

    private HardwareAccessInfoVO.DeviceAccessInfo edgeAccessInfo(EdgeNode node) {
        HardwareAccessInfoVO.DeviceAccessInfo info = new HardwareAccessInfoVO.DeviceAccessInfo();
        info.setDeviceType("edge");
        info.setDeviceNo(node.getNodeNo());
        info.setClientId("longarch-edge-" + node.getNodeNo());
        info.setPublishTopic(mqttProperties.getHeartbeatTopicPrefix() + node.getNodeNo()
                + " | " + mqttProperties.getTelemetryTopicPrefix() + "batch/" + node.getNodeNo());
        info.setSubscribeTopic(mqttProperties.getCommandTopicPrefix() + "+");
        info.setStatus(node.getNetworkStatus());
        info.setLastHeartbeatAt(formatDateTime(node.getLastHeartbeatAt()));
        info.setHeartbeatAgeSeconds(ageSeconds(node.getLastHeartbeatAt()));
        return info;
    }

    private HardwareAccessInfoVO.DeviceAccessInfo sensorAccessInfo(SensorDevice sensor) {
        HardwareAccessInfoVO.DeviceAccessInfo info = new HardwareAccessInfoVO.DeviceAccessInfo();
        info.setDeviceType("sensor");
        info.setDeviceNo(sensor.getDeviceNo());
        info.setClientId("longarch-sensor-" + sensor.getDeviceNo());
        info.setPublishTopic(mqttProperties.getTelemetryTopicPrefix() + sensor.getDeviceNo());
        info.setSubscribeTopic(null);
        info.setStatus(sensor.getStatus());
        info.setLastHeartbeatAt(formatDateTime(sensor.getLastSampleAt()));
        info.setHeartbeatAgeSeconds(ageSeconds(sensor.getLastSampleAt()));
        return info;
    }

    private HardwareAccessInfoVO.DeviceAccessInfo actuatorAccessInfo(ActuatorDevice actuator) {
        HardwareAccessInfoVO.DeviceAccessInfo info = new HardwareAccessInfoVO.DeviceAccessInfo();
        info.setDeviceType("actuator");
        info.setDeviceNo(actuator.getDeviceNo());
        info.setClientId("longarch-actuator-" + actuator.getDeviceNo());
        info.setPublishTopic(mqttProperties.getCallbackTopicPrefix() + actuator.getDeviceNo());
        info.setSubscribeTopic(mqttProperties.getCommandTopicPrefix() + actuator.getDeviceNo());
        info.setStatus(actuator.getDeviceStatus());
        info.setLastHeartbeatAt(formatDateTime(actuator.getLastHeartbeatAt()));
        info.setHeartbeatAgeSeconds(ageSeconds(actuator.getLastHeartbeatAt()));
        info.setLastError(latestActuatorError(actuator.getId()));
        return info;
    }

    private HardwareAccessInfoVO.DeviceAccessInfo cameraAccessInfo(CameraDevice camera) {
        HardwareAccessInfoVO.DeviceAccessInfo info = new HardwareAccessInfoVO.DeviceAccessInfo();
        info.setDeviceType("camera");
        info.setDeviceNo(camera.getDeviceNo());
        info.setClientId("longarch-camera-" + camera.getDeviceNo());
        info.setPublishTopic(mqttProperties.getHeartbeatTopicPrefix() + "{edgeNodeNo}");
        info.setSubscribeTopic(null);
        info.setStatus(camera.getNetworkStatus());
        return info;
    }

    private String latestActuatorError(Long deviceId) {
        OperationTask task = taskMapper.selectOne(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getDeviceId, deviceId)
                        .eq(OperationTask::getTaskStatus, "failed")
                        .orderByDesc(OperationTask::getUpdatedAt)
                        .last("LIMIT 1"));
        return task != null ? task.getFailReason() : null;
    }

    private String formatDateTime(LocalDateTime value) {
        return value != null ? value.format(FMT) : null;
    }

    private Long ageSeconds(LocalDateTime value) {
        if (value == null) {
            return null;
        }
        return Math.max(java.time.Duration.between(value, LocalDateTime.now()).getSeconds(), 0L);
    }

    private <T> DeviceOverviewVO.DeviceGroupStat buildDeviceStat(String type, List<T> devices) {
        DeviceOverviewVO.DeviceGroupStat stat = new DeviceOverviewVO.DeviceGroupStat();
        stat.setDeviceType(type);
        stat.setTotal(devices.size());
        int online = 0, offline = 0, registered = 0;
        for (T d : devices) {
            String status = extractStatus(d);
            if ("online".equalsIgnoreCase(status)) online++;
            else if ("registered".equalsIgnoreCase(status)) registered++;
            else offline++;
        }
        stat.setOnline(online);
        stat.setOffline(offline);
        stat.setRegistered(registered);
        return stat;
    }

    private String extractStatus(Object device) {
        if (device instanceof CameraDevice c) return c.getNetworkStatus();
        if (device instanceof SensorDevice s) return s.getStatus();
        if (device instanceof ActuatorDevice a) return a.getDeviceStatus();
        if (device instanceof ScreenDevice sc) return sc.getStatus();
        return "unknown";
    }

    @Override
    public PageResult<SensorDeviceListVO> listSensorDevices(int pageNo, int pageSize, Long plotId, String category) {
        LambdaQueryWrapper<SensorDevice> qw = new LambdaQueryWrapper<>();
        if (plotId != null) qw.eq(SensorDevice::getPlotId, plotId);
        if (category != null && !category.isBlank()) qw.eq(SensorDevice::getCategory, category);
        qw.orderByDesc(SensorDevice::getCreatedAt);

        Page<SensorDevice> page = sensorDeviceMapper.selectPage(new Page<>(pageNo, pageSize), qw);

        List<SensorDeviceListVO> voList = page.getRecords().stream().map(sensor -> {
            SensorDeviceListVO vo = new SensorDeviceListVO();
            vo.setSensorId(sensor.getId());
            vo.setDeviceNo(sensor.getDeviceNo());
            vo.setSensorName(sensor.getSensorName());
            vo.setSensorType(sensor.getSensorType());
            vo.setCategory(sensor.getCategory());
            vo.setUnit(sensor.getUnit());
            vo.setStatus(sensor.getStatus());
            vo.setPlotId(sensor.getPlotId());
            vo.setLastValue(sensor.getLastValue());
            vo.setLastSampleAt(sensor.getLastSampleAt() != null ? sensor.getLastSampleAt().format(FMT) : null);

            // 查地块名
            Plot plot = plotMapper.selectById(sensor.getPlotId());
            vo.setPlotName(plot != null ? plot.getPlotName() : "未知地块");

            // 查最新各指标数据
            List<com.longarch.module.sensor.entity.SensorData> recentData = sensorDataMapper.selectList(
                    new LambdaQueryWrapper<com.longarch.module.sensor.entity.SensorData>()
                            .eq(com.longarch.module.sensor.entity.SensorData::getSensorId, sensor.getId())
                            .orderByDesc(com.longarch.module.sensor.entity.SensorData::getSampleAt)
                            .last("LIMIT 50"));
            Map<String, Object> metrics = new java.util.LinkedHashMap<>();
            for (com.longarch.module.sensor.entity.SensorData data : recentData) {
                metrics.putIfAbsent(data.getSensorType(), data.getValue());
            }
            vo.setLatestMetrics(metrics);
            return vo;
        }).collect(java.util.stream.Collectors.toList());

        return PageResult.of(voList, pageNo, pageSize, page.getTotal());
    }

    @Override
    public PageResult<SensorDataHistoryVO> listSensorData(Long sensorId, int pageNo, int pageSize, String sensorType) {
        LambdaQueryWrapper<com.longarch.module.sensor.entity.SensorData> qw = new LambdaQueryWrapper<>();
        qw.eq(com.longarch.module.sensor.entity.SensorData::getSensorId, sensorId);
        if (sensorType != null && !sensorType.isBlank()) {
            qw.eq(com.longarch.module.sensor.entity.SensorData::getSensorType, sensorType);
        }
        qw.orderByDesc(com.longarch.module.sensor.entity.SensorData::getSampleAt);

        Page<com.longarch.module.sensor.entity.SensorData> page = sensorDataMapper.selectPage(
                new Page<>(pageNo, pageSize), qw);

        List<SensorDataHistoryVO> voList = page.getRecords().stream().map(data -> {
            SensorDataHistoryVO vo = new SensorDataHistoryVO();
            vo.setId(data.getId());
            vo.setSensorId(data.getSensorId());
            vo.setSensorType(data.getSensorType());
            vo.setValue(data.getValue());
            vo.setSampleAt(data.getSampleAt() != null ? data.getSampleAt().format(FMT) : null);
            return vo;
        }).collect(java.util.stream.Collectors.toList());

        return PageResult.of(voList, pageNo, pageSize, page.getTotal());
    }

    @Override
    public PlotSensorOverviewVO getPlotSensorOverview(Long plotId) {
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "地块不存在: plotId=" + plotId);
        }

        PlotSensorOverviewVO vo = new PlotSensorOverviewVO();
        vo.setPlotId(plotId);
        vo.setPlotName(plot.getPlotName());

        List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plotId));

        List<PlotSensorOverviewVO.SensorGroupInfo> envList = new java.util.ArrayList<>();
        List<PlotSensorOverviewVO.SensorGroupInfo> soilList = new java.util.ArrayList<>();

        for (SensorDevice sensor : sensors) {
            PlotSensorOverviewVO.SensorGroupInfo info = new PlotSensorOverviewVO.SensorGroupInfo();
            info.setSensorId(sensor.getId());
            info.setDeviceNo(sensor.getDeviceNo());
            info.setSensorName(sensor.getSensorName());
            info.setSensorType(sensor.getSensorType());
            info.setStatus(sensor.getStatus());
            info.setLastSampleAt(sensor.getLastSampleAt() != null ? sensor.getLastSampleAt().format(FMT) : null);

            // 查该传感器最新各指标数据
            List<com.longarch.module.sensor.entity.SensorData> recentData = sensorDataMapper.selectList(
                    new LambdaQueryWrapper<com.longarch.module.sensor.entity.SensorData>()
                            .eq(com.longarch.module.sensor.entity.SensorData::getSensorId, sensor.getId())
                            .orderByDesc(com.longarch.module.sensor.entity.SensorData::getSampleAt)
                            .last("LIMIT 50"));
            Map<String, Object> metrics = new java.util.LinkedHashMap<>();
            for (com.longarch.module.sensor.entity.SensorData data : recentData) {
                metrics.putIfAbsent(data.getSensorType(), data.getValue());
            }
            info.setMetrics(metrics);

            if ("environment".equalsIgnoreCase(sensor.getCategory())) {
                envList.add(info);
            } else {
                soilList.add(info);
            }
        }

        vo.setEnvironment(envList);
        vo.setSoil(soilList);
        vo.setUpdatedAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    // ===== 摄像头管理 =====

    @Override
    public PageResult<CameraListVO> listCameras(int pageNo, int pageSize, Long plotId, String networkStatus) {
        LambdaQueryWrapper<CameraDevice> qw = new LambdaQueryWrapper<>();
        if (plotId != null) {
            qw.eq(CameraDevice::getPlotId, plotId);
        }
        if (networkStatus != null && !networkStatus.isEmpty()) {
            qw.eq(CameraDevice::getNetworkStatus, networkStatus);
        }
        qw.orderByDesc(CameraDevice::getId);

        Page<CameraDevice> page = cameraMapper.selectPage(new Page<>(pageNo, pageSize), qw);

        // 一次性查询 SRS 活跃流，避免 N+1
        Set<String> activeStreams = srsStreamService.getActiveStreamKeys();

        List<CameraListVO> list = page.getRecords().stream().map(cam -> {
            CameraListVO vo2 = new CameraListVO();
            vo2.setCameraId(cam.getId());
            vo2.setDeviceNo(cam.getDeviceNo());
            vo2.setCameraName(cam.getCameraName());
            vo2.setPlotId(cam.getPlotId());
            Plot p = plotMapper.selectById(cam.getPlotId());
            vo2.setPlotName(p != null ? p.getPlotName() : "");
            vo2.setStreamProtocol(cam.getStreamProtocol());
            vo2.setStreamApp(cam.getStreamApp());
            vo2.setStreamName(cam.getStreamName());
            vo2.setRtmpPushUrl(cam.getRtmpPushUrl());
            String app = cam.getStreamApp() != null ? cam.getStreamApp() : mediaServerProperties.getLiveApp();
            String stream = cam.getStreamName() != null ? cam.getStreamName() : cam.getDeviceNo();
            vo2.setFlvPlayUrl(mediaServerProperties.getHttpFlvBase() + "/" + app + "/" + stream + ".flv");
            vo2.setHlsPlayUrl(mediaServerProperties.getHlsBase() + "/" + app + "/" + stream + ".m3u8");
            vo2.setPlaybackEnabled(cam.getPlaybackEnabled() != null && cam.getPlaybackEnabled() == 1);
            vo2.setPtzEnabled(cam.getPtzEnabled() != null && cam.getPtzEnabled() == 1);
            vo2.setNetworkStatus(cam.getNetworkStatus());
            vo2.setDeviceStatus(cam.getDeviceStatus());
            vo2.setSnapshotUrl(cam.getSnapshotUrl());
            vo2.setCreatedAt(cam.getCreatedAt() != null ? cam.getCreatedAt().format(FMT) : null);
            vo2.setStreaming(activeStreams.contains(app + "/" + stream));
            return vo2;
        }).collect(java.util.stream.Collectors.toList());

        return PageResult.of(list, pageNo, pageSize, page.getTotal());
    }

    @Override
    @Transactional
    public CameraListVO updateCamera(Long cameraId, UpdateCameraReq req) {
        CameraDevice cam = cameraMapper.selectById(cameraId);
        if (cam == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "摄像头不存在: cameraId=" + cameraId);
        }
        if (req.getCameraName() != null) cam.setCameraName(req.getCameraName());
        if (req.getStreamProtocol() != null) cam.setStreamProtocol(req.getStreamProtocol());
        if (req.getStreamApp() != null) cam.setStreamApp(req.getStreamApp());
        if (req.getStreamName() != null) cam.setStreamName(req.getStreamName());
        if (req.getRtmpPushUrl() != null) cam.setRtmpPushUrl(req.getRtmpPushUrl());
        if (req.getPlaybackEnabled() != null) cam.setPlaybackEnabled(req.getPlaybackEnabled() ? 1 : 0);
        if (req.getPtzEnabled() != null) cam.setPtzEnabled(req.getPtzEnabled() ? 1 : 0);
        cameraMapper.updateById(cam);
        log.info("Admin updated camera: cameraId={}, deviceNo={}", cameraId, cam.getDeviceNo());

        // 复用 listCameras 里的 VO 构建逻辑
        CameraListVO vo2 = new CameraListVO();
        vo2.setCameraId(cam.getId());
        vo2.setDeviceNo(cam.getDeviceNo());
        vo2.setCameraName(cam.getCameraName());
        vo2.setPlotId(cam.getPlotId());
        Plot p = plotMapper.selectById(cam.getPlotId());
        vo2.setPlotName(p != null ? p.getPlotName() : "");
        vo2.setStreamProtocol(cam.getStreamProtocol());
        vo2.setStreamApp(cam.getStreamApp());
        vo2.setStreamName(cam.getStreamName());
        vo2.setRtmpPushUrl(cam.getRtmpPushUrl());
        String app = cam.getStreamApp() != null ? cam.getStreamApp() : mediaServerProperties.getLiveApp();
        String stream = cam.getStreamName() != null ? cam.getStreamName() : cam.getDeviceNo();
        vo2.setFlvPlayUrl(mediaServerProperties.getHttpFlvBase() + "/" + app + "/" + stream + ".flv");
        vo2.setHlsPlayUrl(mediaServerProperties.getHlsBase() + "/" + app + "/" + stream + ".m3u8");
        vo2.setPlaybackEnabled(cam.getPlaybackEnabled() != null && cam.getPlaybackEnabled() == 1);
        vo2.setPtzEnabled(cam.getPtzEnabled() != null && cam.getPtzEnabled() == 1);
        vo2.setNetworkStatus(cam.getNetworkStatus());
        vo2.setDeviceStatus(cam.getDeviceStatus());
        vo2.setSnapshotUrl(cam.getSnapshotUrl());
        vo2.setCreatedAt(cam.getCreatedAt() != null ? cam.getCreatedAt().format(FMT) : null);
        return vo2;
    }

    @Override
    @Transactional
    public void deleteCamera(Long cameraId) {
        CameraDevice cam = cameraMapper.selectById(cameraId);
        if (cam == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "摄像头不存在: cameraId=" + cameraId);
        }
        cameraMapper.deleteById(cameraId);
        log.info("Admin deleted camera: cameraId={}, deviceNo={}", cameraId, cam.getDeviceNo());
    }
}
