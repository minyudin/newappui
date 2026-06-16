package com.longarch.module.auth.service;

import cn.dev33.satoken.stp.StpUtil;
import com.longarch.BaseTest;
import com.longarch.common.exception.BizException;
import com.longarch.module.auth.dto.GuestLoginReq;
import com.longarch.module.auth.dto.WechatLoginReq;
import com.longarch.module.auth.vo.UserInfoVO;
import com.longarch.module.auth.vo.WechatLoginVO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthServiceTest extends BaseTest {

    @Autowired
    private AuthService authService;

    @AfterEach
    void logout() {
        try { StpUtil.logout(); } catch (Exception ignored) {}
    }

    // ===== wechatLogin =====

    @Test
    @Order(1)
    void wechatLogin_newUser_shouldCreateAdopter() {
        WechatLoginReq req = new WechatLoginReq();
        req.setCode("new_test_user");

        WechatLoginVO vo = authService.wechatLogin(req);

        assertNotNull(vo.getToken());
        assertNotNull(vo.getUserInfo());
        assertEquals("adopter", vo.getUserInfo().getRoleType());
        assertNotNull(vo.getUserInfo().getRoleProfile());
        assertEquals("认养用户", vo.getUserInfo().getRoleProfile().getRoleName());
        assertNotNull(vo.getUserInfo().getPermissions());
        assertNotNull(vo.getUserInfo().getMenuScopes());
    }

    @Test
    @Order(2)
    void wechatLogin_existingUser_shouldReturnSame() {
        // 已有 admin_openid -> stub模式下会变成 stub_admin_raw
        // 先用同一个 code 登录两次
        WechatLoginReq req = new WechatLoginReq();
        req.setCode("repeat_user");

        WechatLoginVO vo1 = authService.wechatLogin(req);
        StpUtil.logout();

        WechatLoginVO vo2 = authService.wechatLogin(req);

        assertEquals(vo1.getUserInfo().getUserId(), vo2.getUserInfo().getUserId());
    }

    // ===== guestLogin =====

    @Test
    @Order(10)
    void guestLogin_validGuestCode_shouldCreateGuestUser() {
        GuestLoginReq req = new GuestLoginReq();
        req.setCode("GUEST-001");

        WechatLoginVO vo = authService.guestLogin(req);

        assertNotNull(vo.getToken());
        assertEquals("guest", vo.getUserInfo().getRoleType());
        assertEquals("游客/分享访问者", vo.getUserInfo().getRoleProfile().getRoleName());
    }

    @Test
    @Order(11)
    void guestLogin_expiredCode_shouldFail() {
        GuestLoginReq req = new GuestLoginReq();
        req.setCode("EXPIRED-001");

        assertThrows(BizException.class, () -> authService.guestLogin(req));
    }

    @Test
    @Order(12)
    void guestLogin_invalidCode_shouldFail() {
        GuestLoginReq req = new GuestLoginReq();
        req.setCode("NOT_EXIST_CODE");

        assertThrows(BizException.class, () -> authService.guestLogin(req));
    }

    @Test
    @Order(13)
    void guestLogin_masterCode_shouldFail() {
        GuestLoginReq req = new GuestLoginReq();
        req.setCode("MASTER-001");

        assertThrows(BizException.class, () -> authService.guestLogin(req));
    }

    // ===== getCurrentUser =====

    @Test
    @Order(20)
    void getCurrentUser_success() {
        StpUtil.login(1L);
        StpUtil.getSession().set("roleType", "admin");

        UserInfoVO vo = authService.getCurrentUser();

        assertEquals(1L, vo.getUserId());
        assertEquals("admin", vo.getRoleType());
        assertEquals("平台管理员", vo.getRoleProfile().getRoleName());
        assertTrue(vo.getPermissions().get("canManageUser"));
    }
}
