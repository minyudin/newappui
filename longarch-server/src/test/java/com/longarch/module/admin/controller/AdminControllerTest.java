package com.longarch.module.admin.controller;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.stp.StpUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.BaseTest;
import com.longarch.module.admin.dto.CreateUserReq;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AdminControllerTest extends BaseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @AfterEach
    void logout() {
        try { StpUtil.logout(); } catch (Exception ignored) {}
    }

    private String getTokenName() {
        return SaManager.getConfig().getTokenName();
    }

    private String adminToken() {
        StpUtil.login(1L);
        StpUtil.getSession().set("roleType", "admin");
        return StpUtil.getTokenValue();
    }

    private String adopterToken() {
        StpUtil.login(2L);
        StpUtil.getSession().set("roleType", "adopter");
        return StpUtil.getTokenValue();
    }

    // ===== 角色鉴权测试 =====

    @Test
    @Order(1)
    void admin_createUser_withAdminRole_shouldSucceed() throws Exception {
        String token = adminToken();

        CreateUserReq req = new CreateUserReq();
        req.setOpenId("mvc_test_user_" + System.currentTimeMillis());
        req.setRoleType("adopter");

        mockMvc.perform(post("/api/v1/admin/users")
                        .header(getTokenName(), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.roleType").value("adopter"))
                .andExpect(jsonPath("$.data.userId").isNumber());
    }

    @Test
    @Order(2)
    void admin_createUser_withAdopterRole_shouldBeForbidden() throws Exception {
        String token = adopterToken();

        CreateUserReq req = new CreateUserReq();
        req.setOpenId("should_not_create");
        req.setRoleType("adopter");

        mockMvc.perform(post("/api/v1/admin/users")
                        .header(getTokenName(), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40004));
    }

    @Test
    @Order(3)
    void admin_createUser_withoutToken_shouldFail() throws Exception {
        CreateUserReq req = new CreateUserReq();
        req.setOpenId("no_token_user");
        req.setRoleType("adopter");

        mockMvc.perform(post("/api/v1/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40002));
    }

    // ===== 参数校验测试 =====

    @Test
    @Order(10)
    void admin_createUser_missingOpenId_shouldFail() throws Exception {
        String token = adminToken();

        CreateUserReq req = new CreateUserReq();
        req.setRoleType("adopter");
        // openId is missing

        mockMvc.perform(post("/api/v1/admin/users")
                        .header(getTokenName(), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40001));
    }

    // ===== getActuatorDevice =====

    @Test
    @Order(20)
    void admin_getActuatorDevice_success() throws Exception {
        String token = adminToken();

        mockMvc.perform(get("/api/v1/admin/actuator-devices/1")
                        .header(getTokenName(), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.deviceId").value(1));
    }
}
