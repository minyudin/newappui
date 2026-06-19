package com.longarch.module.ai.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.longarch.common.config.RateLimitProperties;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.common.result.R;
import com.longarch.common.service.RateLimitService;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.ai.dto.AiChatReq;
import com.longarch.module.ai.dto.AiCreateTaskReq;
import com.longarch.module.ai.dto.AiGeneralChatReq;
import com.longarch.module.ai.service.AiAnalysisService;
import com.longarch.module.ai.service.AiService;
import com.longarch.module.ai.vo.AiAnalysisVO;
import com.longarch.module.ai.vo.AiChatVO;
import com.longarch.module.task.vo.CreateTaskVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "AI助手")
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final AiAnalysisService aiAnalysisService;
    private final AccessScopeService accessScopeService;
    private final RateLimitService rateLimitService;
    private final RateLimitProperties rateLimitProperties;

    @Operation(summary = "API-26 AI智能对话")
    @PostMapping("/chat")
    public R<AiChatVO> chat(@Valid @RequestBody AiChatReq req) {
        enforceAiLimit();
        checkPlotAccess(req.getPlotId());
        return R.ok(aiService.chat(req));
    }

    @Operation(summary = "AI全局农业问答（不绑定地块）")
    @PostMapping("/general-chat")
    public R<AiChatVO> generalChat(@Valid @RequestBody AiGeneralChatReq req) {
        enforceAiLimit();
        return R.ok(aiService.generalChat(req));
    }

    @Operation(summary = "API-27 AI创建操作任务")
    @PostMapping("/actions/create-operation-task")
    public R<CreateTaskVO> createTask(@Valid @RequestBody AiCreateTaskReq req) {
        enforceAiLimit();
        checkPlotAccess(req.getPlotId());
        return R.ok(aiService.createTask(req));
    }

    @Operation(summary = "触发AI数据分析（手动/定时均可调用）")
    @PostMapping("/analysis/trigger")
    public R<AiAnalysisVO> triggerAnalysis(@RequestParam Long plotId) {
        enforceAiLimit();
        checkPlotAccess(plotId);
        return R.ok(aiAnalysisService.analyzePlot(plotId, "manual"));
    }

    @Operation(summary = "获取地块最新AI分析结论")
    @GetMapping("/analysis/latest")
    public R<AiAnalysisVO> latestAnalysis(@RequestParam Long plotId) {
        checkPlotAccess(plotId);
        AiAnalysisVO vo = aiAnalysisService.getLatestAnalysis(plotId);
        if (vo == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "该地块暂无AI分析记录");
        }
        return R.ok(vo);
    }

    private void checkPlotAccess(Long plotId) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_plot");
    }

    /** AI 调用走外网智谱、最贵，按登录用户限流，防止单用户刷爆把小服务器线程/外网 IO 占满。 */
    private void enforceAiLimit() {
        if (!rateLimitProperties.isEnabled()) {
            return;
        }
        rateLimitService.enforce("aiInvoke", "rl:ai:user:" + StpUtil.getLoginIdAsLong(),
                rateLimitProperties.getAiInvoke());
    }
}
