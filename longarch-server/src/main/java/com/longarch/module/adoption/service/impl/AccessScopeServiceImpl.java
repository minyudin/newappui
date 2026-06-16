package com.longarch.module.adoption.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.PageResult;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.entity.AdoptionOrder;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.adoption.mapper.AdoptionOrderMapper;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.adoption.vo.*;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccessScopeServiceImpl implements AccessScopeService {

    private final AdoptionCodeMapper adoptionCodeMapper;
    private final AdoptionOrderMapper adoptionOrderMapper;
    private final PlotMapper plotMapper;
    private final CropBatchMapper cropBatchMapper;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public AccessScopeVO getAccessScope(Long plotId) {
        Long userId = StpUtil.getLoginIdAsLong();

        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getPlotId, plotId)
                        .eq(AdoptionCode::getStatus, "active")
                        // 生产口径：同地块按“该用户已绑定认养码”的最新 order_id 判权
                        // 兼容 guest/share（guest 不一定写入 adoption_order.user_id）
                        .apply("order_id = (SELECT MAX(ac2.order_id) FROM adoption_code ac2 WHERE ac2.bind_user_id = {0} AND ac2.plot_id = {1} AND ac2.status = 'active')", userId, plotId)
                        .last("LIMIT 1"));

        if (code == null) {
            throw new BizException(ErrorCode.PLOT_ACCESS_DENIED, "无该地块访问权限");
        }

        AdoptionOrder order = adoptionOrderMapper.selectById(code.getOrderId());
        if (order == null || !"active".equals(order.getOrderStatus())) {
            throw new BizException(ErrorCode.ORDER_EXPIRED, "认养订单已失效");
        }

        List<String> whitelist = parseWhitelist(code.getOperationWhitelist());

        AccessScopeVO vo = new AccessScopeVO();
        vo.setPlotId(plotId);
        vo.setOrderId(order.getId());

        AccessScopeVO.Visibility vis = new AccessScopeVO.Visibility();
        vis.setCanViewPlotInfo(true);
        vis.setCanViewLiveVideo(code.getCanViewLive() == 1);
        vis.setCanViewHistoryVideo(code.getCanViewHistory() == 1);
        vis.setHistoryDays(code.getHistoryDays());
        vis.setCanViewSensorData(code.getCanViewSensor() == 1);
        vis.setCanViewOperationLog(true);
        vis.setCanViewAiAnalysis(true);
        vo.setVisibility(vis);

        AccessScopeVO.Operation op = new AccessScopeVO.Operation();
        op.setCanOperate(code.getCanOperate() == 1);
        op.setOperationWhitelist(whitelist);
        op.setMaxDailyOperations(code.getMaxDailyOperations());
        op.setCanReserveTask(code.getCanOperate() == 1);
        op.setCanCancelPendingTask(code.getCanOperate() == 1);
        vo.setOperation(op);

        AccessScopeVO.TimeWindow tw = new AccessScopeVO.TimeWindow();
        tw.setValidFrom(code.getValidFrom().format(FMT));
        tw.setValidTo(code.getValidTo().format(FMT));
        tw.setDailyAccessStart(code.getDailyAccessStart() != null ? code.getDailyAccessStart().toString() : null);
        tw.setDailyAccessEnd(code.getDailyAccessEnd() != null ? code.getDailyAccessEnd().toString() : null);
        vo.setTimeWindow(tw);

        return vo;
    }

    @Override
    public PageResult<AdoptionListVO> getMyAdoptions(int pageNo, int pageSize, String status) {
        Long userId = StpUtil.getLoginIdAsLong();

        LambdaQueryWrapper<AdoptionOrder> wrapper = new LambdaQueryWrapper<AdoptionOrder>()
                .eq(AdoptionOrder::getUserId, userId)
                // 同地块仅显示最新一条订单（按 id 近似时间倒序）
                .apply("id IN (SELECT MAX(o2.id) FROM adoption_order o2 WHERE o2.user_id = {0} GROUP BY o2.plot_id)", userId)
                .apply("EXISTS (SELECT 1 FROM adoption_code ac WHERE ac.order_id = adoption_order.id AND ac.bind_user_id = {0} AND ac.status = 'active')", userId)
                .orderByDesc(AdoptionOrder::getCreatedAt);

        if (status != null && !status.isBlank()) {
            wrapper.eq(AdoptionOrder::getOrderStatus, status);
        }

        Page<AdoptionOrder> page = adoptionOrderMapper.selectPage(new Page<>(pageNo, pageSize), wrapper);

        List<AdoptionListVO> voList = page.getRecords().stream().map(order -> {
            AdoptionListVO vo = new AdoptionListVO();
            vo.setOrderId(order.getId());
            vo.setOrderNo(order.getOrderNo());
            vo.setPlotId(order.getPlotId());
            vo.setCropBatchId(order.getCropBatchId());
            vo.setStartAt(order.getStartAt().format(FMT));
            vo.setEndAt(order.getEndAt().format(FMT));
            vo.setOrderStatus(order.getOrderStatus());

            Plot plot = plotMapper.selectById(order.getPlotId());
            if (plot != null) {
                vo.setPlotName(plot.getPlotName());
                vo.setCoverUrl(plot.getLiveCoverUrl());
            }

            if (order.getCropBatchId() != null) {
                CropBatch batch = cropBatchMapper.selectById(order.getCropBatchId());
                if (batch != null) {
                    vo.setCropName(batch.getCropName());
                    vo.setVarietyName(batch.getVarietyName());
                    vo.setGrowthStage(batch.getGrowthStage());
                }
            }
            return vo;
        }).collect(Collectors.toList());

        return PageResult.from(page, voList);
    }

    @Override
    public AdoptionDetailVO getAdoptionDetail(Long orderId) {
        Long userId = StpUtil.getLoginIdAsLong();
        AdoptionOrder order = adoptionOrderMapper.selectById(orderId);
        if (order == null || !userId.equals(order.getUserId())) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "认养订单不存在");
        }
        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getOrderId, orderId)
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getStatus, "active")
                        .last("LIMIT 1"));
        if (code == null) {
            throw new BizException(ErrorCode.PLOT_ACCESS_DENIED, "请先兑换认养码后再查看");
        }

        AdoptionDetailVO vo = new AdoptionDetailVO();
        vo.setOrderId(order.getId());
        vo.setOrderNo(order.getOrderNo());
        vo.setPlotId(order.getPlotId());
        vo.setCropBatchId(order.getCropBatchId());
        vo.setAdoptionType(order.getAdoptionType());
        vo.setStartAt(order.getStartAt().format(FMT));
        vo.setEndAt(order.getEndAt().format(FMT));
        vo.setOrderStatus(order.getOrderStatus());
        vo.setVisibilityLevel(order.getVisibilityLevel());
        vo.setOperationLevel(order.getOperationLevel());

        Plot plot = plotMapper.selectById(order.getPlotId());
        if (plot != null) {
            vo.setPlotName(plot.getPlotName());
        }

        if (order.getCropBatchId() != null) {
            CropBatch batch = cropBatchMapper.selectById(order.getCropBatchId());
            if (batch != null) {
                vo.setCropName(batch.getCropName());
                vo.setVarietyName(batch.getVarietyName());
            }
        }
        return vo;
    }

    @Override
    public void checkFeatureAccess(Long plotId, String feature) {
        Long userId = StpUtil.getLoginIdAsLong();

        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getPlotId, plotId)
                        .eq(AdoptionCode::getStatus, "active")
                        // 生产口径：按 bind_user_id 在 adoption_code 维度判“最新有效码”
                        .apply("order_id = (SELECT MAX(ac2.order_id) FROM adoption_code ac2 WHERE ac2.bind_user_id = {0} AND ac2.plot_id = {1} AND ac2.status = 'active')", userId, plotId)
                        .last("LIMIT 1"));

        if (code == null) {
            throw new BizException(ErrorCode.PLOT_ACCESS_DENIED, "无该地块访问权限");
        }

        // 校验认养码有效期
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (now.isBefore(code.getValidFrom()) || now.isAfter(code.getValidTo())) {
            throw new BizException(ErrorCode.PLOT_ACCESS_DENIED, "认养码不在有效期内");
        }

        switch (feature) {
            case "can_view_plot":
                // 只要持有该地块的有效码即可查看基本信息（null check 上面已做）
                break;
            case "can_view_live":
                if (code.getCanViewLive() != 1) {
                    throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "当前权限不允许查看实时监控");
                }
                break;
            case "can_view_history":
                if (code.getCanViewHistory() != 1) {
                    throw new BizException(ErrorCode.PLAYBACK_NOT_ALLOWED, "当前权限不允许查看历史回放");
                }
                break;
            case "can_view_sensor":
                if (code.getCanViewSensor() != 1) {
                    throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "当前权限不允许查看传感器数据");
                }
                break;
            case "can_operate":
                if (code.getCanOperate() != 1) {
                    throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "当前权限不允许操作");
                }
                // 每日时间窗只约束“操作”，不约束“查看数据”
                if (code.getDailyAccessStart() != null && code.getDailyAccessEnd() != null) {
                    java.time.LocalTime currentTime = now.toLocalTime();
                    if (currentTime.isBefore(code.getDailyAccessStart()) || currentTime.isAfter(code.getDailyAccessEnd())) {
                        throw new BizException(ErrorCode.PLOT_ACCESS_DENIED, "不在允许操作时段");
                    }
                }
                break;
            default:
                break;
        }
    }

    private List<String> parseWhitelist(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
