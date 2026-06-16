package com.longarch.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 注册时补昵称 / 后续改昵称 共用请求体
 *  · 校验细节交给 NicknameValidator (中文错误信息更友好)
 *  · 这里只兜底非空
 */
@Data
public class SetupNicknameReq {

    @NotBlank(message = "昵称不能为空")
    private String nickname;
}
