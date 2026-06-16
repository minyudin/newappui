package com.longarch.module.auth.controller;

import com.longarch.common.result.R;
import com.longarch.module.auth.dto.AdminLoginReq;
import com.longarch.module.auth.dto.BindMobileReq;
import com.longarch.module.auth.dto.GuestLoginReq;
import com.longarch.module.auth.dto.SetupNicknameReq;
import com.longarch.module.auth.dto.WechatLoginReq;
import com.longarch.module.auth.service.AuthService;
import com.longarch.module.auth.vo.BindMobileVO;
import com.longarch.module.auth.vo.NicknameAvailabilityVO;
import com.longarch.module.auth.vo.UserInfoVO;
import com.longarch.module.auth.vo.WechatLoginVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "登录与用户")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "API-01 微信登录")
    @PostMapping("/auth/wechat-login")
    public R<WechatLoginVO> wechatLogin(@Valid @RequestBody WechatLoginReq req) {
        return R.ok(authService.wechatLogin(req));
    }

    @Operation(summary = "游客/分享码登录")
    @PostMapping("/auth/guest-login")
    public R<WechatLoginVO> guestLogin(@Valid @RequestBody GuestLoginReq req) {
        return R.ok(authService.guestLogin(req));
    }

    @Operation(summary = "API-02 绑定手机号")
    @PostMapping("/auth/bind-mobile")
    public R<BindMobileVO> bindMobile(@Valid @RequestBody BindMobileReq req) {
        return R.ok(authService.bindMobile(req));
    }

    @Operation(summary = "API-03 获取当前用户信息")
    @GetMapping("/users/me")
    public R<UserInfoVO> getCurrentUser() {
        return R.ok(authService.getCurrentUser());
    }

    @Operation(summary = "DEV-管理后台直接登录（仅stub模式可用）")
    @PostMapping("/auth/dev-login")
    public R<WechatLoginVO> devLogin(@RequestBody java.util.Map<String, String> body) {
        return R.ok(authService.devLogin(body.get("openId")));
    }

    @Operation(summary = "管理员后台密码登录（mobile + password）")
    @PostMapping("/auth/admin-login")
    public R<WechatLoginVO> adminLogin(@Valid @RequestBody AdminLoginReq req) {
        return R.ok(authService.adminLogin(req));
    }

    @Operation(summary = "登出（清 session + 擦除 HttpOnly cookie）")
    @PostMapping("/auth/logout")
    public R<Void> logout() {
        authService.logout();
        return R.ok();
    }

    @Operation(summary = "注册补昵称 · 微信新用户必须先调一次, 才能进业务")
    @PostMapping("/auth/setup-nickname")
    public R<UserInfoVO> setupNickname(@Valid @RequestBody SetupNicknameReq req) {
        return R.ok(authService.setupNickname(req));
    }

    @Operation(summary = "改昵称 · 已注册用户主动改名 (登录态)")
    @PostMapping("/auth/change-nickname")
    public R<UserInfoVO> changeNickname(@Valid @RequestBody SetupNicknameReq req) {
        return R.ok(authService.changeNickname(req));
    }

    @Operation(summary = "昵称可用性预检 · 注册输入框失焦/防抖调用")
    @PostMapping("/auth/check-nickname")
    public R<NicknameAvailabilityVO> checkNickname(@Valid @RequestBody SetupNicknameReq req) {
        return R.ok(authService.checkNicknameAvailability(req.getNickname()));
    }
}
