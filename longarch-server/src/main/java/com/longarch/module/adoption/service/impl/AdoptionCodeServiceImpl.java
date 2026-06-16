package com.longarch.module.adoption.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.module.adoption.dto.CreateShareCodeReq;
import com.longarch.module.adoption.dto.RedeemCodeReq;
import com.longarch.module.adoption.dto.VerifyCodeReq;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.entity.AdoptionOrder;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.adoption.mapper.AdoptionOrderMapper;
import com.longarch.module.adoption.service.AdoptionCodeService;
import com.longarch.module.adoption.vo.RedeemCodeVO;
import com.longarch.module.adoption.vo.ShareCodeVO;
import com.longarch.module.adoption.vo.VerifyCodeVO;
import com.longarch.common.config.BusinessDefaultsProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdoptionCodeServiceImpl implements AdoptionCodeService {

    private final AdoptionCodeMapper adoptionCodeMapper;
    private final AdoptionOrderMapper adoptionOrderMapper;
    private final ObjectMapper objectMapper;
    private final BusinessDefaultsProperties bizDefaults;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public VerifyCodeVO verify(VerifyCodeReq req) {
        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>().eq(AdoptionCode::getCode, req.getCode()));

        if (code == null) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "认养码不存在");
        }

        LocalDateTime now = LocalDateTime.now();
        if (!"active".equals(code.getStatus())) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "认养码已失效");
        }
        if (now.isBefore(code.getValidFrom()) || now.isAfter(code.getValidTo())) {
            throw new BizException(ErrorCode.ADOPTION_CODE_EXPIRED, "认养码不在有效期内");
        }

        VerifyCodeVO vo = new VerifyCodeVO();
        vo.setValid(true);
        vo.setCodeType(code.getCodeType());
        vo.setStatus(code.getStatus());
        vo.setOrderId(code.getOrderId());
        vo.setPlotId(code.getPlotId());
        vo.setCropBatchId(code.getCropBatchId());
        vo.setValidFrom(code.getValidFrom().format(FMT));
        vo.setValidTo(code.getValidTo().format(FMT));
        vo.setDailyAccessStart(code.getDailyAccessStart() != null ? code.getDailyAccessStart().toString() : null);
        vo.setDailyAccessEnd(code.getDailyAccessEnd() != null ? code.getDailyAccessEnd().toString() : null);

        VerifyCodeVO.Permissions perms = new VerifyCodeVO.Permissions();
        perms.setCanViewLive(code.getCanViewLive() == 1);
        perms.setCanViewHistory(code.getCanViewHistory() == 1);
        perms.setHistoryDays(code.getHistoryDays());
        perms.setCanViewSensor(code.getCanViewSensor() == 1);
        perms.setCanOperate(code.getCanOperate() == 1);
        perms.setOperationWhitelist(parseWhitelist(code.getOperationWhitelist()));
        perms.setMaxDailyOperations(code.getMaxDailyOperations());
        perms.setShareable(code.getShareable() == 1);
        vo.setPermissions(perms);

        return vo;
    }

    @Override
    @Transactional
    public RedeemCodeVO redeem(RedeemCodeReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        log.info("redeem code={}, userId={}", req.getCode(), userId);

        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>().eq(AdoptionCode::getCode, req.getCode()));

        if (code == null) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "认养码不存在");
        }
        if (!"active".equals(code.getStatus())) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "认养码已失效");
        }

        // 幂等：已被当前用户兑换过，直接返回
        if (userId.equals(code.getBindUserId())) {
            log.info("Idempotent redeem: code already bound to current user");
            return buildRedeemVO(code);
        }

        // 已被其他用户兑换
        if (code.getBindUserId() != null) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "认养码已被其他用户使用");
        }

        // 检查订单有效性
        AdoptionOrder order = adoptionOrderMapper.selectById(code.getOrderId());
        if (order == null || "expired".equals(order.getOrderStatus()) || "cancelled".equals(order.getOrderStatus())) {
            throw new BizException(ErrorCode.ORDER_EXPIRED, "认养订单已失效");
        }
        // 校验“用户ID + 认养码”一致性：
        // 若订单已指定目标用户，只允许该用户兑换该码。
        if (order.getUserId() != null && !userId.equals(order.getUserId())) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "该认养码不属于当前用户");
        }

        // 原子绑定：仅允许 bind_user_id 仍为空时更新，避免并发兑换互相覆盖
        int bindUpdated = adoptionCodeMapper.update(null,
                new LambdaUpdateWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getId, code.getId())
                        .isNull(AdoptionCode::getBindUserId)
                        .eq(AdoptionCode::getStatus, "active")
                        .set(AdoptionCode::getBindUserId, userId));
        if (bindUpdated == 0) {
            AdoptionCode latest = adoptionCodeMapper.selectById(code.getId());
            if (latest != null && userId.equals(latest.getBindUserId())) {
                log.info("Idempotent redeem after concurrent bind: code={}, userId={}", req.getCode(), userId);
                return buildRedeemVO(latest);
            }
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "认养码已被其他用户使用");
        }
        code.setBindUserId(userId);

        // 同步更新订单的用户绑定
        if (order.getUserId() == null) {
            order.setUserId(userId);
            if ("pending".equals(order.getOrderStatus())) {
                order.setOrderStatus("active");
            }
            adoptionOrderMapper.updateById(order);
        } else if ("pending".equals(order.getOrderStatus())) {
            // 已指定用户的订单，在首次成功兑换后激活
            order.setOrderStatus("active");
            adoptionOrderMapper.updateById(order);
        }

        log.info("Code redeemed: code={}, userId={}, orderId={}", req.getCode(), userId, code.getOrderId());
        return buildRedeemVO(code);
    }

    private RedeemCodeVO buildRedeemVO(AdoptionCode code) {
        RedeemCodeVO vo = new RedeemCodeVO();
        vo.setRedeemed(true);
        vo.setOrderId(code.getOrderId());
        vo.setPlotId(code.getPlotId());
        vo.setBindUserId(code.getBindUserId());
        return vo;
    }

    // ========== 分享码功能 ==========

    @Override
    @Transactional
    public ShareCodeVO createShareCode(CreateShareCodeReq req) {
        Long userId = StpUtil.getLoginIdAsLong();

        // 1. 查找当前用户在该地块的 master 码
        AdoptionCode masterCode = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getPlotId, req.getPlotId())
                        .eq(AdoptionCode::getCodeType, "master")
                        .eq(AdoptionCode::getStatus, "active")
                        // 产品口径一致：分享来源限定为该地块“最新订单”的 master 码
                        .apply("order_id = (SELECT MAX(ao.id) FROM adoption_order ao WHERE ao.user_id = {0} AND ao.plot_id = {1})", userId, req.getPlotId())
                        .last("LIMIT 1"));
        if (masterCode == null) {
            throw new BizException(ErrorCode.PLOT_ACCESS_DENIED, "您不是该地块的 master 码持有者");
        }

        // 2. 校验 master 码允许分享
        if (masterCode.getShareable() == null || masterCode.getShareable() != 1) {
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "您的认养码不允许分享");
        }

        // 3. 校验 master 码自身在有效期内
        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(masterCode.getValidFrom()) || now.isAfter(masterCode.getValidTo())) {
            throw new BizException(ErrorCode.ADOPTION_CODE_EXPIRED, "您的认养码已过期，无法分享");
        }

        // 4. 计算分享码有效期（不能超过 master 码的 valid_to）
        int validDays = (req.getValidDays() != null && req.getValidDays() > 0) ? req.getValidDays() : 7;
        LocalDateTime shareValidTo = now.plusDays(validDays);
        if (shareValidTo.isAfter(masterCode.getValidTo())) {
            shareValidTo = masterCode.getValidTo();
        }

        // 5. 权限子集校验：分享的权限不能超过 master 码自身
        int canViewLive = clampPermission(req.getCanViewLive(), masterCode.getCanViewLive());
        int canViewHistory = clampPermission(req.getCanViewHistory(), masterCode.getCanViewHistory());
        int canViewSensor = clampPermission(req.getCanViewSensor(), masterCode.getCanViewSensor());
        int canOperate = clampPermission(req.getCanOperate(), masterCode.getCanOperate());
        int historyDays = Math.min(
                req.getHistoryDays() != null ? req.getHistoryDays() : masterCode.getHistoryDays(),
                masterCode.getHistoryDays());
        int maxDailyOps = Math.min(
                req.getMaxDailyOperations() != null ? req.getMaxDailyOperations() : masterCode.getMaxDailyOperations(),
                masterCode.getMaxDailyOperations());
        List<String> masterWhitelist = parseWhitelist(masterCode.getOperationWhitelist());
        List<String> requestedWhitelist = req.getOperationWhitelist() != null
                ? parseWhitelist(req.getOperationWhitelist())
                : masterWhitelist;
        Set<String> normalized = new LinkedHashSet<>(requestedWhitelist);
        normalized.retainAll(masterWhitelist);
        String finalWhitelist = toJsonWhitelist(normalized);

        // 6. 生成分享码记录
        AdoptionCode shareCode = new AdoptionCode();
        shareCode.setCode(bizDefaults.getShareCodePrefix() + IdUtil.fastSimpleUUID().substring(0, 8).toUpperCase());
        shareCode.setCodeType("share");
        shareCode.setOrderId(masterCode.getOrderId());
        shareCode.setPlotId(masterCode.getPlotId());
        shareCode.setCropBatchId(masterCode.getCropBatchId());
        shareCode.setBindUserId(null);
        shareCode.setStatus("active");
        shareCode.setValidFrom(now);
        shareCode.setValidTo(shareValidTo);
        shareCode.setDailyAccessStart(
                req.getDailyAccessStart() != null ? LocalTime.parse(req.getDailyAccessStart()) : masterCode.getDailyAccessStart());
        shareCode.setDailyAccessEnd(
                req.getDailyAccessEnd() != null ? LocalTime.parse(req.getDailyAccessEnd()) : masterCode.getDailyAccessEnd());
        shareCode.setCanViewLive(canViewLive);
        shareCode.setCanViewHistory(canViewHistory);
        shareCode.setHistoryDays(historyDays);
        shareCode.setCanViewSensor(canViewSensor);
        shareCode.setCanOperate(canOperate);
        shareCode.setOperationWhitelist(finalWhitelist);
        shareCode.setMaxDailyOperations(maxDailyOps);
        shareCode.setShareable(0);
        shareCode.setCreatedByUserId(userId);
        adoptionCodeMapper.insert(shareCode);

        log.info("Share code created: codeId={}, code={}, plotId={}, by={}",
                shareCode.getId(), shareCode.getCode(), req.getPlotId(), userId);

        return buildShareCodeVO(shareCode);
    }

    @Override
    public List<ShareCodeVO> getMyShares(Long plotId) {
        Long userId = StpUtil.getLoginIdAsLong();

        LambdaQueryWrapper<AdoptionCode> wrapper = new LambdaQueryWrapper<AdoptionCode>()
                .eq(AdoptionCode::getCreatedByUserId, userId)
                .eq(AdoptionCode::getCodeType, "share")
                .orderByDesc(AdoptionCode::getCreatedAt);
        if (plotId != null) {
            wrapper.eq(AdoptionCode::getPlotId, plotId);
        }

        return adoptionCodeMapper.selectList(wrapper).stream()
                .map(this::buildShareCodeVO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void revokeShareCode(Long codeId) {
        Long userId = StpUtil.getLoginIdAsLong();

        AdoptionCode code = adoptionCodeMapper.selectById(codeId);
        if (code == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "分享码不存在");
        }
        if (!"share".equals(code.getCodeType())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "只能撤销分享码");
        }
        if (!userId.equals(code.getCreatedByUserId())) {
            throw new BizException(ErrorCode.FORBIDDEN, "只能撤销自己生成的分享码");
        }
        if ("revoked".equals(code.getStatus())) {
            return; // 幂等
        }

        code.setStatus("revoked");
        adoptionCodeMapper.updateById(code);

        log.info("Share code revoked: codeId={}, code={}, by={}", codeId, code.getCode(), userId);
    }

    private int clampPermission(Integer requested, Integer masterMax) {
        if (masterMax == null || masterMax == 0) return 0;
        if (requested == null) return masterMax;
        return Math.min(requested, masterMax);
    }

    private ShareCodeVO buildShareCodeVO(AdoptionCode code) {
        ShareCodeVO vo = new ShareCodeVO();
        vo.setCodeId(code.getId());
        vo.setCode(code.getCode());
        vo.setCodeType(code.getCodeType());
        vo.setPlotId(code.getPlotId());
        vo.setOrderId(code.getOrderId());
        vo.setCreatedByUserId(code.getCreatedByUserId());
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
        vo.setOperationWhitelist(code.getOperationWhitelist());
        vo.setMaxDailyOperations(code.getMaxDailyOperations());
        vo.setCreatedAt(code.getCreatedAt() != null ? code.getCreatedAt().format(FMT) : null);
        return vo;
    }

    private List<String> parseWhitelist(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String toJsonWhitelist(Set<String> whitelist) {
        try {
            return objectMapper.writeValueAsString(whitelist);
        } catch (Exception e) {
            return "[]";
        }
    }
}
