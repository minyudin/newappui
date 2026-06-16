package com.longarch.module.ai.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.module.ai.client.ZhipuClient;
import com.longarch.module.ai.dto.AiChatReq;
import com.longarch.module.ai.dto.AiCreateTaskReq;
import com.longarch.module.ai.dto.AiGeneralChatReq;
import com.longarch.module.ai.entity.AiAnalysisRecord;
import com.longarch.module.ai.guard.OperationSafetyGuard;
import com.longarch.module.ai.guard.PermissionGuard;
import com.longarch.module.ai.guard.SensorDataGuard;
import com.longarch.module.ai.mapper.AiAnalysisRecordMapper;
import com.longarch.module.ai.service.AiService;
import com.longarch.module.ai.vo.AiChatVO;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.task.dto.CreateTaskReq;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import com.longarch.module.task.service.TaskService;
import com.longarch.module.task.vo.CreateTaskVO;
import com.longarch.common.util.RequestIdUtil;
import com.longarch.common.config.BusinessDefaultsProperties;
import com.longarch.common.config.AiSafetyProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiServiceImpl implements AiService {

    private final TaskService taskService;
    private final ZhipuClient zhipuClient;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final CropBatchMapper cropBatchMapper;
    private final AiAnalysisRecordMapper analysisRecordMapper;
    private final SensorDataGuard sensorDataGuard;
    private final OperationSafetyGuard operationSafetyGuard;
    private final PermissionGuard permissionGuard;
    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final BusinessDefaultsProperties bizDefaults;
    private final AiSafetyProperties aiSafetyProperties;

    private static final java.util.Map<String, String> ACTION_TO_DEVICE_TYPE = java.util.Map.of(
            "irrigation_apply", "irrigator",
            "fertilize_apply", "fertilizer",
            "spray_apply", "sprayer"
    );

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String buildSystemPrompt() {
        String name = bizDefaults.getAiAssistantName();
        return """
            你是"%s"智慧农场小程序的AI助手。你的职责：
            1. 根据传感器实时数据和作物信息，回答用户关于农场的问题
            2. 当用户要求操作时，先分析传感器数据判断是否合理，再给出建议
            3. 如果用户明确要求执行操作（浇水/施肥/喷淋），且数据支持该操作，说明你可以帮他创建任务
            4. 如果数据不支持用户的操作请求，要说明原因并给出更合理的建议
            5. 如果有数据质量警告或安全警告，必须在回复中体现，不能忽略
            6. 只引用提供给你的数据，不要编造任何数值
            
            当前系统支持的操作类型：
            - irrigation_apply: 申请浇水（土壤湿度<45%%时建议）
            - fertilize_apply: 申请施肥（根据生长阶段判断）
            - spray_apply: 申请喷淋（病虫害或降温需求时建议）
            
            请用简洁友好的中文回复，不超过200字。基于数据给出专业判断。
            """.formatted(name);
    }

    private String buildGeneralSystemPrompt() {
        String name = bizDefaults.getAiAssistantName();
        return """
            你是"%s"的农业问答助手，面向普通用户回答基础农业问题。
            规则：
            1. 不要编造地块实时数据，不要假装读取了用户设备数据。
            2. 只回答通用农业知识、种植建议、风险提醒。
            3. 遇到不确定问题，明确说明限制并给出可执行的排查步骤。
            4. 回复简洁清晰，150字以内，中文。
            """.formatted(name);
    }

    @Override
    public AiChatVO chat(AiChatReq req) {
        log.info("AI chat: requestId={}, sessionId={}, plotId={}, message={}", RequestIdUtil.get(), req.getSessionId(), req.getPlotId(), req.getMessage());

        // 1. 采集传感器数据 + 数据质量守卫
        List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, req.getPlotId()));
        SensorDataGuard.SensorQualityReport sensorReport = sensorDataGuard.evaluate(sensors);

        String sensorContext = buildSensorContext(sensors);
        String cropContext = buildCropContext(req.getPlotId());
        String latestAnalysis = buildLatestAnalysisContext(req.getPlotId());

        // 2. 检测意图
        String intent = detectIntent(req.getMessage());
        boolean isOperation = intent.contains("apply");

        // 3. 如果是操作意图，预先做安全检查
        String safetyWarning = "";
        boolean safetyBlocked = false;
        if (isOperation) {
            OperationSafetyGuard.SafetyCheckResult safetyResult = operationSafetyGuard.check(req.getPlotId(), intent);
            if (safetyResult.isBlocked()) {
                safetyBlocked = true;
                safetyWarning = "【⛔ 安全系统拦截】" + String.join("；", safetyResult.getReasons()) + "\n";
            } else if (safetyResult.hasWarnings()) {
                safetyWarning = "【⚠️ 安全提醒】" + String.join("；", safetyResult.getWarnings()) + "\n";
            }
        }

        // 4. 构建完整上下文发给 GLM
        StringBuilder userMsg = new StringBuilder();
        userMsg.append(String.format("【地块ID: %d】\n", req.getPlotId()));
        userMsg.append(sensorReport.toPromptText());
        userMsg.append(sensorContext);
        userMsg.append(cropContext);
        userMsg.append(latestAnalysis);
        if (!safetyWarning.isEmpty()) userMsg.append(safetyWarning);
        userMsg.append(String.format("\n用户说: %s", req.getMessage()));
        if (safetyBlocked) {
            userMsg.append("\n\n【系统指令】安全系统已拦截此操作，你必须告知用户被拦截的原因，不能建议创建任务。");
        }

        String aiReply = zhipuClient.chat(buildSystemPrompt(), userMsg.toString());
        if (aiReply == null || aiReply.isBlank()) {
            aiReply = buildRuleBasedFallbackReply(req.getMessage(), sensors, intent, sensorReport, safetyWarning);
        }

        // 5. 如果安全拦截，强制不允许确认
        boolean needConfirm = isOperation && !safetyBlocked;

        // 6. 构建响应
        AiChatVO vo = new AiChatVO();
        vo.setSessionId(req.getSessionId());
        vo.setIntent(intent);
        vo.setTargetPlotId(req.getPlotId());
        vo.setTargetDeviceId(needConfirm ? findDeviceId(req.getPlotId(), intent) : null);
        vo.setAction(needConfirm ? intent : null);
        vo.setParams(null);
        vo.setNeedConfirm(needConfirm);
        vo.setPermissionCheck(!safetyBlocked);
        vo.setSchedulingMode(needConfirm ? "queue" : null);
        vo.setRiskLevel(safetyBlocked ? "high" : (sensorReport.hasWarnings() ? "medium" : "low"));
        vo.setReply(aiReply);
        vo.setSuggestion(needConfirm ? "如确认操作，我可以为你创建任务。" :
                (safetyBlocked ? "操作已被安全系统拦截，请查看原因。" : null));

        return vo;
    }

    @Override
    public AiChatVO generalChat(AiGeneralChatReq req) {
        String aiReply = zhipuClient.chat(buildGeneralSystemPrompt(), req.getMessage());
        boolean fallbackUsed = false;
        if (aiReply == null || aiReply.isBlank()) {
            // 智谱 API 不可用 (key 缺失 / 配额耗尽 / 网络异常) → 走兜底
            // 文案要诚实, 不要假装"标准农业建议", 否则会误导用户
            aiReply = "AI 服务暂时无法回答你的问题, 这通常是因为后端未配置 ZHIPU_API_KEY 或调用失败. " +
                    "你可以稍后再试, 或联系管理员检查后端日志 (关键字: Zhipu API).";
            fallbackUsed = true;
        }

        AiChatVO vo = new AiChatVO();
        vo.setSessionId(req.getSessionId());
        // fallback 时用专门的 intent, 让前端能识别并展示降级标记
        vo.setIntent(fallbackUsed ? "fallback_unavailable" : "general_query");
        vo.setTargetPlotId(null);
        vo.setTargetDeviceId(null);
        vo.setAction(null);
        vo.setParams(null);
        vo.setNeedConfirm(false);
        vo.setPermissionCheck(true);
        vo.setSchedulingMode(null);
        vo.setRiskLevel("low");
        vo.setReply(aiReply);
        vo.setSuggestion(fallbackUsed
                ? "如需配置 AI: 智谱开放平台注册免费 glm-4-flash · 设环境变量 ZHIPU_API_KEY 后重启后端"
                : "如需精准建议, 请在地块详情页使用「问 AI」.");
        return vo;
    }

    private String buildRuleBasedFallbackReply(
            String userMessage,
            List<SensorDevice> sensors,
            String intent,
            SensorDataGuard.SensorQualityReport report,
            String safetyText
    ) {
        java.util.Map<String, BigDecimal> rawMetrics = reqPlotRawMetrics(sensors);
        BigDecimal soilMoisture = findMetricByAliases(
                rawMetrics,
                List.of("soil_moisture", "soil_humidity", "soilMoisture", "soilhumidity", "soilmoisture", "vwc")
        );
        BigDecimal temp = findMetricByAliases(
                rawMetrics,
                List.of("temperature", "air_temperature", "temp")
        );

        StringBuilder sb = new StringBuilder();
        sb.append("已基于当前传感器数据进行规则分析。");
        if (report != null && report.hasWarnings()) {
            sb.append("数据质量提示：").append(String.join("；", report.getWarnings())).append("。");
        }
        if (soilMoisture != null) {
            sb.append("土壤湿度约 ").append(soilMoisture).append("%。");
        }
        if (temp != null) {
            sb.append("气温约 ").append(temp).append("℃。");
        }

        if ("irrigation_apply".equals(intent)) {
            if (soilMoisture == null) {
                sb.append("未匹配到土壤湿度关键指标，建议先确认传感器口径后再浇水。");
            } else if (soilMoisture.compareTo(BigDecimal.valueOf(aiSafetyProperties.getSoilMoistureBlockHigh())) > 0) {
                sb.append("当前湿度偏高，不建议浇水。");
            } else if (soilMoisture.compareTo(BigDecimal.valueOf(aiSafetyProperties.getSoilMoistureSuggestDry())) < 0) {
                sb.append("当前偏干，可考虑小流量浇水并复测。");
            } else {
                sb.append("当前湿度处于可接受区间，暂不建议立即浇水。");
            }
        } else if ("fertilize_apply".equals(intent)) {
            sb.append("施肥建议需结合作物阶段与近期施肥记录，建议小剂量试施并观察。");
        } else if ("spray_apply".equals(intent)) {
            sb.append("喷淋建议结合气温与病虫害情况，优先在低温时段执行。");
        } else {
            sb.append("如你要执行浇水/施肥/喷淋，我可继续按安全规则给出可执行建议。");
        }

        if (safetyText != null && !safetyText.isBlank()) {
            sb.append(" ").append(safetyText).append("。");
        }
        return sb.toString();
    }

    private java.util.Map<String, BigDecimal> reqPlotRawMetrics(List<SensorDevice> sensors) {
        java.util.Map<String, BigDecimal> metrics = new java.util.LinkedHashMap<>();
        if (sensors == null || sensors.isEmpty()) return metrics;
        Long plotId = sensors.get(0).getPlotId();
        if (plotId == null) return metrics;
        List<SensorData> latest = sensorDataMapper.selectList(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getPlotId, plotId)
                        .orderByDesc(SensorData::getSampleAt)
                        .last("LIMIT 400"));
        for (SensorData d : latest) {
            if (d.getValue() == null || d.getSensorType() == null) continue;
            String key = normalize(d.getSensorType());
            metrics.putIfAbsent(key, d.getValue());
        }
        // 兜底：补充设备快照值
        for (SensorDevice s : sensors) {
            if (s.getLastValue() == null) continue;
            if (s.getSensorType() != null) metrics.putIfAbsent(normalize(s.getSensorType()), s.getLastValue());
            if (s.getSensorName() != null) metrics.putIfAbsent(normalize(s.getSensorName()), s.getLastValue());
        }
        return metrics;
    }

    private BigDecimal findMetricByAliases(java.util.Map<String, BigDecimal> metrics, List<String> aliases) {
        for (java.util.Map.Entry<String, BigDecimal> entry : metrics.entrySet()) {
            String key = entry.getKey();
            for (String alias : aliases) {
                String a = normalize(alias);
                if (key.equals(a) || key.contains(a)) {
                    return entry.getValue();
                }
            }
        }
        return null;
    }

    private boolean isAliasMatch(String raw, List<String> aliases) {
        if (raw == null || raw.isBlank()) return false;
        String normalized = normalize(raw);
        for (String alias : aliases) {
            String a = normalize(alias);
            if (normalized.equals(a) || normalized.contains(a)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase().replaceAll("[^a-z0-9\\u4e00-\\u9fa5]", "");
    }

    private String buildSensorContext(List<SensorDevice> sensors) {
        if (sensors.isEmpty()) return "【传感器数据】暂无\n";
        StringBuilder sb = new StringBuilder("【传感器实时数据】\n");
        for (SensorDevice s : sensors) {
            sb.append(String.format("- %s(%s): %s %s (采样: %s)\n",
                    s.getSensorName(), s.getSensorType(), s.getLastValue(), s.getUnit(),
                    s.getLastSampleAt() != null ? s.getLastSampleAt().format(FMT) : "无"));
        }
        return sb.toString();
    }

    private String buildCropContext(Long plotId) {
        CropBatch crop = cropBatchMapper.selectOne(
                new LambdaQueryWrapper<CropBatch>()
                        .eq(CropBatch::getPlotId, plotId)
                        .eq(CropBatch::getBatchStatus, "active")
                        .last("LIMIT 1"));
        if (crop == null) return "【作物信息】暂无\n";
        return String.format("【作物信息】%s(%s) 生长阶段:%s 备注:%s 风险:%s\n",
                crop.getCropName(), crop.getVarietyName(), crop.getGrowthStage(),
                crop.getNextTask() != null ? crop.getNextTask() : "无",
                crop.getRiskHint() != null ? crop.getRiskHint() : "无");
    }

    private String buildLatestAnalysisContext(Long plotId) {
        AiAnalysisRecord record = analysisRecordMapper.selectOne(
                new LambdaQueryWrapper<AiAnalysisRecord>()
                        .eq(AiAnalysisRecord::getPlotId, plotId)
                        .orderByDesc(AiAnalysisRecord::getCreatedAt)
                        .last("LIMIT 1"));
        if (record == null) return "";
        return String.format("【最近AI分析结论】(%s) %s\n",
                record.getCreatedAt() != null ? record.getCreatedAt().format(FMT) : "",
                record.getAnalysisResult());
    }

    private Long findDeviceId(Long plotId, String actionType) {
        String deviceType = ACTION_TO_DEVICE_TYPE.get(actionType);
        if (deviceType == null) return null;
        ActuatorDevice device = actuatorDeviceMapper.selectOne(
                new LambdaQueryWrapper<ActuatorDevice>()
                        .eq(ActuatorDevice::getPlotId, plotId)
                        .eq(ActuatorDevice::getDeviceType, deviceType)
                        .last("LIMIT 1"));
        return device != null ? device.getId() : null;
    }

    private String detectIntent(String message) {
        String m = message.toLowerCase();
        if (m.contains("浇水") || m.contains("灌溉") || m.contains("浇") && m.contains("水") || m.contains("灌")) return "irrigation_apply";
        if (m.contains("施肥") || m.contains("肥料") || m.contains("施") && m.contains("肥") || m.contains("追肥") || m.contains("上肥")) return "fertilize_apply";
        if (m.contains("喷淋") || m.contains("喷雾") || m.contains("喷") || m.contains("打药")) return "spray_apply";
        return "general_query";
    }

    @Override
    public CreateTaskVO createTask(AiCreateTaskReq req) {
        Long userId = StpUtil.getLoginIdAsLong();
        log.info("AI createTask: requestId={}, sessionId={}, userId={}, plotId={}, action={}", RequestIdUtil.get(), req.getSessionId(), userId, req.getPlotId(), req.getActionType());

        // Guard 1: 权限校验（白名单+每日次数+时间窗口+认养码有效期）
        PermissionGuard.PermissionCheckResult permResult = permissionGuard.check(userId, req.getPlotId(), req.getActionType());
        if (permResult.isBlocked()) {
            log.warn("AI createTask BLOCKED by PermissionGuard: userId={}, reason={}", userId, permResult.getBlockMessage());
            throw new BizException(ErrorCode.FORBIDDEN, "权限校验未通过: " + permResult.getBlockMessage());
        }

        // Guard 2: 操作安全校验（硬性阈值）
        OperationSafetyGuard.SafetyCheckResult safetyResult = operationSafetyGuard.check(req.getPlotId(), req.getActionType());
        if (safetyResult.isBlocked()) {
            log.warn("AI createTask BLOCKED by SafetyGuard: plotId={}, reason={}", req.getPlotId(), safetyResult.getReasons());
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED, "安全校验未通过: " + String.join("；", safetyResult.getReasons()));
        }

        // 通过所有守卫 → 创建任务
        CreateTaskReq taskReq = new CreateTaskReq();
        taskReq.setPlotId(req.getPlotId());
        taskReq.setDeviceId(req.getDeviceId());
        taskReq.setActionType(req.getActionType());
        taskReq.setActionParams(req.getActionParams());
        taskReq.setSchedulingMode("queue");
        taskReq.setIdempotencyKey("ai-" + req.getSessionId() + "-" + req.getPlotId() + "-" + req.getActionType());

        return taskService.createTask(taskReq);
    }
}
