package com.longarch.module.ai.service;

import com.longarch.module.ai.dto.AiChatReq;
import com.longarch.module.ai.dto.AiCreateTaskReq;
import com.longarch.module.ai.dto.AiGeneralChatReq;
import com.longarch.module.ai.vo.AiChatVO;
import com.longarch.module.task.vo.CreateTaskVO;

public interface AiService {

    AiChatVO chat(AiChatReq req);
    AiChatVO generalChat(AiGeneralChatReq req);

    CreateTaskVO createTask(AiCreateTaskReq req);
}
