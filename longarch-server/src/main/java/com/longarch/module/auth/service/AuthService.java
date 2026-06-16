package com.longarch.module.auth.service;

import com.longarch.module.auth.dto.AdminLoginReq;
import com.longarch.module.auth.dto.BindMobileReq;
import com.longarch.module.auth.dto.GuestLoginReq;
import com.longarch.module.auth.dto.SetupNicknameReq;
import com.longarch.module.auth.dto.WechatLoginReq;
import com.longarch.module.auth.vo.BindMobileVO;
import com.longarch.module.auth.vo.NicknameAvailabilityVO;
import com.longarch.module.auth.vo.UserInfoVO;
import com.longarch.module.auth.vo.WechatLoginVO;

public interface AuthService {

    WechatLoginVO wechatLogin(WechatLoginReq req);

    WechatLoginVO guestLogin(GuestLoginReq req);

    BindMobileVO bindMobile(BindMobileReq req);

    UserInfoVO getCurrentUser();

    WechatLoginVO devLogin(String openId);

    /**
     * 管理员后台密码登录
     * 对齐: 仅 roleType=admin · BCrypt 校验 · 失败 5 次锁 15 分钟
     */
    WechatLoginVO adminLogin(AdminLoginReq req);

    /**
     * 登出
     *  · 调用 StpUtil.logout() 清除 Redis 中的 session
     *  · Sa-Token 自动向响应写入 Set-Cookie: satoken=; Max-Age=0 擦除浏览器 cookie
     *  · 未登录调用为幂等空操作 (不抛异常)
     */
    void logout();

    /**
     * 注册补昵称 · 强制注册流程的"激活"步骤
     *  · 当前 user.nickname IS NULL 时允许设置, 否则抛 NICKNAME_ALREADY_SET (40021)
     *  · 校验合规 (NicknameValidator) + 唯一性 (DB uk_nickname 兜底)
     *  · 成功后返回最新 UserInfoVO
     */
    UserInfoVO setupNickname(SetupNicknameReq req);

    /**
     * 改昵称 · 已注册用户主动改名 (miniapp pages/me 入口)
     *  · 与 setupNickname 区别: 不要求当前 nickname 必须为 NULL
     *  · 允许同一个值"无意义提交"幂等 (前端兜底, 后端不抛错)
     *  · 校验 + 唯一性兜底链路与 setupNickname 完全一致
     */
    UserInfoVO changeNickname(SetupNicknameReq req);

    /**
     * 昵称可用性预检 · 输入框防抖调用
     *  · 不抛异常, 始终返回 NicknameAvailabilityVO
     *  · 不消耗 NICKNAME_INVALID 错误码 (体验更柔)
     */
    NicknameAvailabilityVO checkNicknameAvailability(String nickname);
}
