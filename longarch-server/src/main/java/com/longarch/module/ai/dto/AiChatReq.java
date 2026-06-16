package com.longarch.module.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AiChatReq {

    @NotBlank(message = "会话ID不能为空")
    private String sessionId;

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    @NotBlank(message = "消息内容不能为空")
    private String message;
}
