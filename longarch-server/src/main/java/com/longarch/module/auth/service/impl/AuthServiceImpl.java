package com.longarch.module.auth.service.impl;

import cn.binarywang.wx.miniapp.api.WxMaService;
import cn.binarywang.wx.miniapp.bean.WxMaJscode2SessionResult;
import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.config.WechatMiniProperties;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.config.RateLimitProperties;
import com.longarch.common.service.RateLimitService;
import com.longarch.common.util.ClientIpUtil;
import com.longarch.common.util.NicknameValidator;
import com.longarch.module.auth.dto.AdminLoginReq;
import com.longarch.module.auth.dto.BindMobileReq;
import com.longarch.module.auth.dto.GuestLoginReq;
import com.longarch.module.auth.dto.SetupNicknameReq;
import com.longarch.module.auth.dto.WechatLoginReq;

import java.time.LocalDateTime;
import com.longarch.module.auth.entity.User;
import com.longarch.module.auth.mapper.UserMapper;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.auth.service.AuthService;
import com.longarch.module.auth.vo.BindMobileVO;
import com.longarch.module.auth.vo.NicknameAvailabilityVO;
import com.longarch.module.auth.vo.UserInfoVO;
import com.longarch.module.auth.vo.WechatLoginVO;
import com.longarch.common.enums.RolePermissionConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.chanjar.weixin.common.error.WxErrorException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final AdoptionCodeMapper adoptionCodeMapper;
    private final RateLimitService rateLimitService;
    private final RateLimitProperties rateLimitProperties;
    private final WxMaService wxMaService;
    private final WechatMiniProperties wechatMiniProperties;

    private boolean isStubMode() {
        return wechatMiniProperties.isStubMode();
    }

    @Override
    public WechatLoginVO wechatLogin(WechatLoginReq req) {
        String wechatLimitKey = buildWechatLimitKey(req);
        RateLimitProperties.Rule wechatRule = rateLimitProperties.getWechatLogin();
        long wechatReqCount = rateLimitService.incrementAndGet(wechatLimitKey, wechatRule.getWindowSeconds());
        if (wechatReqCount > wechatRule.getLimit()) {
            rateLimitService.recordHit("wechatLogin");
            log.warn("Rate limit hit: scene=wechatLogin, key={}, count={}, limit={}, window={}s",
                    wechatLimitKey, wechatReqCount, wechatRule.getLimit(), wechatRule.getWindowSeconds());
            throw new BizException(ErrorCode.TOO_MANY_REQUESTS, "登录请求过于频繁，请稍后重试");
        }

        // Stub模式：直接用code当openId
        // 真模式: 调微信 code2session, 拿到 openid + unionid
        WechatSession session = isStubMode()
                ? new WechatSession("stub_" + req.getCode(), null)
                : resolveWechatSession(req.getCode());
        String openId = session.openId();

        log.info("wechatLogin openId={}, unionId={}, stubMode={}",
                openId, session.unionId(), isStubMode());

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getOpenId, openId));

        if (user == null) {
            user = new User();
            user.setOpenId(openId);
            if (session.unionId() != null) {
                user.setUnionId(session.unionId());
            }
            user.setUserNo("U" + IdUtil.getSnowflakeNextIdStr());
            // 强制注册补昵称: 新用户 nickname 默认 null, 前端按 bindNickname=false 跳补昵称页
            //   · stub 模式 + autoFillStubNickname=true · 给个"用户XXXXXX"占位让 e2e 能跑通
            //   · 真模式 / stub 模式 + autoFillStubNickname=false · 留 null 强制走 setup-nickname
            if (isStubMode() && wechatMiniProperties.isAutoFillStubNickname()) {
                user.setNickname("用户" + user.getUserNo().substring(user.getUserNo().length() - 6));
            } else {
                user.setNickname(null);
            }
            user.setRoleType("adopter");
            user.setStatus(1);
            user.setBindMobile(0);
            userMapper.insert(user);
            log.info("New user registered: userId={}, userNo={}, nickname={}",
                    user.getId(), user.getUserNo(), user.getNickname());
        } else if (session.unionId() != null && !session.unionId().equals(user.getUnionId())) {
            // 老账号首次拿到 unionId · 回填一次, 后续多端识别可用
            User patch = new User();
            patch.setId(user.getId());
            patch.setUnionId(session.unionId());
            userMapper.updateById(patch);
            user.setUnionId(session.unionId());
        }

        if (user.getStatus() == 0) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号已被禁用");
        }

        // 若传了 inviteCode，尝试预绑定认养码
        if (req.getInviteCode() != null && !req.getInviteCode().isBlank()) {
            log.info("inviteCode provided: {}, userId={}", req.getInviteCode(), user.getId());
        }

        // 记录最近登录时间 + IP (生产链路审计基线)
        User loginPatch = new User();
        loginPatch.setId(user.getId());
        loginPatch.setLastLoginAt(LocalDateTime.now());
        loginPatch.setLastLoginIp(resolveClientIp());
        userMapper.updateById(loginPatch);

        StpUtil.login(user.getId());
        StpUtil.getSession().set("roleType", user.getRoleType());

        WechatLoginVO vo = new WechatLoginVO();
        vo.setToken(StpUtil.getTokenValue());
        vo.setRefreshToken(IdUtil.fastSimpleUUID());
        vo.setExpiresIn(7200);

        UserInfoVO userInfo = buildUserInfoVO(user);
        vo.setUserInfo(userInfo);
        return vo;
    }

    @Override
    public WechatLoginVO guestLogin(GuestLoginReq req) {
        if (rateLimitProperties.isEnabled()) {
            rateLimitService.enforce("guestLogin", "rl:auth:guest:ip:" + ClientIpUtil.resolve(),
                    rateLimitProperties.getGuestLogin());
        }
        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getCode, req.getCode())
                        .eq(AdoptionCode::getStatus, "active"));

        if (code == null) {
            throw new BizException(ErrorCode.ADOPTION_CODE_INVALID, "分享码无效或已过期");
        }

        if (!"guest".equals(code.getCodeType()) && !"share".equals(code.getCodeType())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "该码不是游客/分享码");
        }

        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (now.isBefore(code.getValidFrom()) || now.isAfter(code.getValidTo())) {
            throw new BizException(ErrorCode.ADOPTION_CODE_EXPIRED, "分享码已过期");
        }

        User user;
        if (code.getBindUserId() != null) {
            user = userMapper.selectById(code.getBindUserId());
        } else {
            // 自动创建临时 guest 用户并绑定
            user = new User();
            user.setOpenId("guest_" + code.getCode() + "_" + IdUtil.fastSimpleUUID().substring(0, 8));
            user.setUserNo("U" + IdUtil.getSnowflakeNextIdStr());
            user.setNickname("游客" + user.getUserNo().substring(user.getUserNo().length() - 6));
            user.setRoleType("guest");
            user.setStatus(1);
            user.setBindMobile(0);
            userMapper.insert(user);

            code.setBindUserId(user.getId());
            adoptionCodeMapper.updateById(code);

            log.info("Guest user created and bound: userId={}, codeId={}", user.getId(), code.getId());
        }

        if (user == null || user.getStatus() == 0) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号不可用");
        }

        StpUtil.login(user.getId());
        StpUtil.getSession().set("roleType", user.getRoleType());

        WechatLoginVO vo = new WechatLoginVO();
        vo.setToken(StpUtil.getTokenValue());
        vo.setRefreshToken(IdUtil.fastSimpleUUID());
        vo.setExpiresIn(7200);
        vo.setUserInfo(buildUserInfoVO(user));
        return vo;
    }

    @Override
    public BindMobileVO bindMobile(BindMobileReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        log.info("bindMobile userId={}, mobile={}", userId, req.getMobile());

        // Stub: 跳过短信验证码校验，直接绑定
        User existing = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getMobile, req.getMobile())
                        .ne(User::getId, userId));
        if (existing != null) {
            throw new BizException(ErrorCode.INVALID_PARAM, "该手机号已被其他账号绑定");
        }

        User user = userMapper.selectById(userId);
        user.setMobile(req.getMobile());
        user.setBindMobile(1);
        userMapper.updateById(user);

        BindMobileVO vo = new BindMobileVO();
        vo.setBindSuccess(true);
        return vo;
    }

    @Override
    public UserInfoVO getCurrentUser() {
        Long userId = StpUtil.getLoginIdAsLong();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在");
        }
        return buildUserInfoVO(user);
    }

    private UserInfoVO buildUserInfoVO(User user) {
        UserInfoVO vo = new UserInfoVO();
        vo.setUserId(user.getId());
        vo.setUserNo(user.getUserNo());
        vo.setNickname(user.getNickname());
        vo.setRealName(user.getRealName());
        vo.setMobile(user.getMobile());
        vo.setAvatarUrl(user.getAvatarUrl());
        vo.setRoleType(user.getRoleType());
        vo.setStatus(user.getStatus());
        vo.setBindMobile(user.getBindMobile() == 1);
        vo.setBindNickname(user.getNickname() != null && !user.getNickname().isBlank());

        RolePermissionConfig config = RolePermissionConfig.fromRoleType(user.getRoleType());
        UserInfoVO.RoleProfile profile = new UserInfoVO.RoleProfile();
        profile.setRoleName(config.getRoleName());
        profile.setRoleDesc(config.getRoleDesc());
        vo.setRoleProfile(profile);
        vo.setPermissions(config.getPermissions());
        vo.setMenuScopes(config.getMenuScopes());

        return vo;
    }

    @Override
    public WechatLoginVO devLogin(String openId) {
        if (!isStubMode()) {
            throw new BizException(ErrorCode.FORBIDDEN, "仅开发模式可用");
        }
        if (openId == null || openId.isBlank()) {
            throw new BizException(ErrorCode.INVALID_PARAM, "openId不能为空");
        }

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getOpenId, openId));
        if (user == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在，openId=" + openId);
        }
        if (user.getStatus() == 0) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号已被禁用");
        }

        StpUtil.login(user.getId());
        StpUtil.getSession().set("roleType", user.getRoleType());

        WechatLoginVO vo = new WechatLoginVO();
        vo.setToken(StpUtil.getTokenValue());
        vo.setRefreshToken(IdUtil.fastSimpleUUID());
        vo.setExpiresIn(7200);
        vo.setUserInfo(buildUserInfoVO(user));
        return vo;
    }

    /**
     * 真模式调用 · 微信 jscode2session
     * ============================================================
     *  · 输入: 小程序 wx.login() 拿到的 5 分钟一次性 code
     *  · 输出: { openId, unionId(可能为空) }
     *  · 错误码:
     *      40029 invalid code · 已用过 / 过期 / 与 appId 不匹配
     *      45011 频率限制
     *      40226 高风险用户
     *  · 一律映射成 INVALID_TOKEN, 让前端显示"微信登录失败,请重试"
     *
     *  · 不在这里包 try-catch 给 stub 兜底; stub 应该走更上层的 isStubMode() 判断,
     *    避免把"配置错误"混淆成"微信侧异常"
     * ============================================================ */
    private WechatSession resolveWechatSession(String code) {
        if (code == null || code.isBlank()) {
            throw new BizException(ErrorCode.INVALID_PARAM, "微信 code 不能为空");
        }
        if (!wechatMiniProperties.hasRealCredentials()) {
            // prod 启动 guard 已挡, 这里属于运维误配兜底
            log.error("wechat.miniapp.app-id/app-secret missing while stubMode=false");
            throw new BizException(ErrorCode.INTERNAL_ERROR, "微信小程序未配置, 请联系管理员");
        }
        try {
            WxMaJscode2SessionResult result = wxMaService.getUserService().getSessionInfo(code);
            return new WechatSession(result.getOpenid(), result.getUnionid());
        } catch (WxErrorException e) {
            int errCode = e.getError() != null ? e.getError().getErrorCode() : -1;
            String errMsg = e.getError() != null ? e.getError().getErrorMsg() : e.getMessage();
            log.warn("wechat code2session failed: errCode={}, errMsg={}", errCode, errMsg);
            // 用户能看到的统一外文案, 内部审计走 log
            throw new BizException(ErrorCode.INVALID_TOKEN,
                    "微信登录失败 (errCode=" + errCode + "), 请重试");
        }
    }

    /** 微信 session 元组 · openId 必填, unionId 可空 (未关联开放平台时) */
    private record WechatSession(String openId, String unionId) {}

    // ============================================================
    //  管理员后台密码登录
    //  · 仅 roleType=admin · BCrypt · 失败 5 次锁 15 分钟
    // ============================================================
    private static final int MAX_FAILED = 5;
    private static final int LOCK_MINUTES = 15;

    @Override
    public WechatLoginVO adminLogin(AdminLoginReq req) {
        String mobile = req.getMobile();
        String adminLimitKey = "rl:auth:admin:" + mobile;
        RateLimitProperties.Rule adminRule = rateLimitProperties.getAdminLogin();
        long adminReqCount = rateLimitService.incrementAndGet(adminLimitKey, adminRule.getWindowSeconds());
        if (adminReqCount > adminRule.getLimit()) {
            rateLimitService.recordHit("adminLogin");
            log.warn("Rate limit hit: scene=adminLogin, key={}, count={}, limit={}, window={}s",
                    adminLimitKey, adminReqCount, adminRule.getLimit(), adminRule.getWindowSeconds());
            throw new BizException(ErrorCode.TOO_MANY_REQUESTS, "登录请求过于频繁，请稍后重试");
        }
        log.info("adminLogin attempt mobile={}", mobile);

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getMobile, mobile));

        // 统一以"账号或密码错误"响应, 避免账号枚举
        if (user == null || !"admin".equals(user.getRoleType())) {
            throw new BizException(ErrorCode.INVALID_PARAM, "账号或密码错误");
        }

        // 账号禁用
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号已被禁用");
        }

        // 锁定检查
        LocalDateTime now = LocalDateTime.now();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw new BizException(ErrorCode.FORBIDDEN,
                    "账号已锁定, 请于 " + user.getLockedUntil() + " 后重试");
        }

        // 密码校验
        String hash = user.getPasswordHash();
        boolean ok = hash != null && !hash.isBlank()
                && BCrypt.checkpw(req.getPassword(), hash);

        if (!ok) {
            int failed = (user.getFailedCount() == null ? 0 : user.getFailedCount()) + 1;
            User patch = new User();
            patch.setId(user.getId());
            if (failed >= MAX_FAILED) {
                patch.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
                patch.setFailedCount(0);
                log.warn("Admin account locked due to {} failures: userId={} mobile={}",
                        MAX_FAILED, user.getId(), mobile);
            } else {
                patch.setFailedCount(failed);
            }
            userMapper.updateById(patch);
            throw new BizException(ErrorCode.INVALID_PARAM, "账号或密码错误");
        }

        // 登录成功: 清零失败计数 + 记录最近登录
        User patch = new User();
        patch.setId(user.getId());
        patch.setFailedCount(0);
        patch.setLockedUntil(null);
        patch.setLastLoginAt(now);
        patch.setLastLoginIp(resolveClientIp());
        userMapper.updateById(patch);

        // 发 token
        StpUtil.login(user.getId());
        StpUtil.getSession().set("roleType", user.getRoleType());

        WechatLoginVO vo = new WechatLoginVO();
        vo.setToken(StpUtil.getTokenValue());
        vo.setRefreshToken(IdUtil.fastSimpleUUID());
        vo.setExpiresIn(7200);
        // 回填 user 的更新字段供 VO 构建
        user.setLastLoginAt(now);
        vo.setUserInfo(buildUserInfoVO(user));

        log.info("adminLogin success userId={} mobile={}", user.getId(), mobile);
        return vo;
    }

    // ============================================================
    //  注册补昵称 / 改昵称
    //  · 强制注册流程: 新用户登录后 nickname=NULL · 必须先调本接口才能进业务
    //  · 唯一性兜底: DB uk_nickname 唯一索引 + 应用层 SELECT 预检
    // ============================================================
    @Override
    @Transactional
    public UserInfoVO setupNickname(SetupNicknameReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        String normalized = NicknameValidator.normalize(req.getNickname());
        NicknameValidator.validate(normalized);

        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在");
        }
        // 强制注册流程: 已经设过昵称就不再允许通过本接口重写, 防越权改名
        // (改名走 changeNickname 接口)
        if (user.getNickname() != null && !user.getNickname().isBlank()) {
            throw new BizException(ErrorCode.NICKNAME_ALREADY_SET, "昵称已设置, 不允许重复设置");
        }

        return persistNickname(user, normalized);
    }

    @Override
    @Transactional
    public UserInfoVO changeNickname(SetupNicknameReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        String normalized = NicknameValidator.normalize(req.getNickname());
        NicknameValidator.validate(normalized);

        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "用户不存在");
        }

        // 体感优化: 与当前昵称完全一致 → 视为幂等成功, 直接返当前 UserInfo, 不消耗唯一索引
        if (normalized.equals(user.getNickname())) {
            log.info("changeNickname noop (same value): userId={}", userId);
            return buildUserInfoVO(user);
        }

        return persistNickname(user, normalized);
    }

    /**
     * 写入 nickname 公共子流程 · setupNickname / changeNickname / admin 强改 共用
     *  · 调用方负责: 鉴权 + 取得 user 实体 + 业务前置 (是否已设过)
     *  · 这里负责: 应用层重名预检 + DB 写入 + DuplicateKeyException 兜底
     */
    private UserInfoVO persistNickname(User user, String normalized) {
        Long userId = user.getId();

        // 应用层去重 · 精确匹配排除自身
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
        } catch (DuplicateKeyException e) {
            // 并发兜底: 同一秒两个用户起同名, 应用层 SELECT 都说 0, 但 DB 唯一索引让其中一个失败
            log.warn("Nickname duplicate caught at DB level: nickname={}", normalized);
            throw new BizException(ErrorCode.NICKNAME_DUPLICATED, "昵称已被占用, 请换一个");
        }

        user.setNickname(normalized);
        log.info("nickname persisted: userId={}, nickname={}", userId, normalized);
        return buildUserInfoVO(user);
    }

    @Override
    public NicknameAvailabilityVO checkNicknameAvailability(String raw) {
        if (rateLimitProperties.isEnabled()) {
            rateLimitService.enforce("checkNickname", "rl:auth:nickname:ip:" + ClientIpUtil.resolve(),
                    rateLimitProperties.getCheckNickname());
        }
        String normalized = NicknameValidator.normalize(raw);
        try {
            NicknameValidator.validate(normalized);
        } catch (BizException e) {
            return NicknameAvailabilityVO.fail(normalized, e.getMessage());
        }

        Long userId = null;
        try {
            // 已登录用户允许"不算自己"
            userId = StpUtil.isLogin() ? StpUtil.getLoginIdAsLong() : null;
        } catch (Exception ignored) {}

        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .eq(User::getNickname, normalized);
        if (userId != null) {
            wrapper.ne(User::getId, userId);
        }
        Long count = userMapper.selectCount(wrapper);
        if (count != null && count > 0) {
            return NicknameAvailabilityVO.fail(normalized, "昵称已被占用");
        }
        return NicknameAvailabilityVO.ok(normalized);
    }

    // ============================================================
    //  登出
    //  · StpUtil.logout() 会清 Redis session + 写 Set-Cookie: satoken=; Max-Age=0
    //  · 未登录为幂等空操作
    // ============================================================
    @Override
    public void logout() {
        if (StpUtil.isLogin()) {
            Object loginId = StpUtil.getLoginId();
            StpUtil.logout();
            log.info("logout userId={}", loginId);
        }
    }

    /** 从当前 HTTP 请求取客户端 IP (尽力而为, 找不到返回 null) */
    private String resolveClientIp() {
        try {
            org.springframework.web.context.request.RequestAttributes attrs =
                    org.springframework.web.context.request.RequestContextHolder
                            .getRequestAttributes();
            if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
                jakarta.servlet.http.HttpServletRequest request = sra.getRequest();
                String forwarded = request.getHeader("X-Forwarded-For");
                if (forwarded != null && !forwarded.isBlank()) {
                    return forwarded.split(",")[0].trim();
                }
                return request.getRemoteAddr();
            }
        } catch (Exception ignored) {
            // 静默
        }
        return null;
    }

    private String buildWechatLimitKey(WechatLoginReq req) {
        String code = req.getCode() != null ? req.getCode() : "";
        if (isStubMode()) {
            // stub 模式下 code 为稳定设备锚点，按 code 限流即可
            return "rl:auth:wechat:stub:" + code;
        }
        // 真实微信 code 一次性且短时有效，不能仅按 code 限流；改为 IP 维度兜底
        String ip = resolveClientIp();
        if (ip == null || ip.isBlank()) {
            ip = "unknown";
        }
        return "rl:auth:wechat:ip:" + ip;
    }
}
