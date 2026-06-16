package com.longarch.module.ai.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.module.ai.client.ZhipuClient;
import com.longarch.module.ai.entity.AiAnalysisRecord;
import com.longarch.module.ai.guard.SensorDataGuard;
import com.longarch.module.ai.mapper.AiAnalysisRecordMapper;
import com.longarch.module.ai.service.AiAnalysisService;
import com.longarch.module.ai.vo.AiAnalysisVO;
import com.longarch.module.plot.entity.CropBatch;
import com.longarch.module.plot.mapper.CropBatchMapper;
import com.longarch.module.plot.mapper.PlotMapper;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.common.config.BusinessDefaultsProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAnalysisServiceImpl implements AiAnalysisService {

    private final ZhipuClient zhipuClient;
    private final AiAnalysisRecordMapper analysisRecordMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final CropBatchMapper cropBatchMapper;
    private final PlotMapper plotMapper;
    private final ObjectMapper objectMapper;
    private final SensorDataGuard sensorDataGuard;
    private final BusinessDefaultsProperties bizDefaults;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long MIN_ANALYSIS_INTERVAL_MINUTES = 10;
    private static final ConcurrentHashMap<Long, Boolean> ANALYZING_PLOTS = new ConcurrentHashMap<>();

    private String buildAnalysisPrompt() {
        String name = bizDefaults.getAiAssistantName();
        return """
            你是"%s"智慧农场的AI农技分析师。你的任务是根据传感器实时数据和作物信息，给出专业的农事分析和操作建议。
            
            请按以下JSON格式返回分析结果（只返回JSON，不要其他文字）：
            {
              "analysisResult": "对当前数据的综合分析（100-200字）",
              "riskLevel": "low/medium/high",
              "suggestedActions": ["建议操作1", "建议操作2"]
            }
            
            分析要点：
            1. 根据土壤湿度判断是否需要灌溉（<40%%偏干，40-60%%适宜，>70%%偏湿）
            2. 根据土壤温度和空气温度判断作物生长环境
            3. 根据土壤pH值判断是否需要调节
            4. 结合作物当前生长阶段给出针对性建议
            5. 识别异常数据或风险并预警
            
            suggestedActions 中如果需要操作设备，使用以下格式：
            - "建议浇水：[原因]" → 对应 irrigation_apply
            - "建议施肥：[原因]" → 对应 fertilize_apply
            - "建议喷淋：[原因]" → 对应 spray_apply
            - 其他为纯建议，不触发设备操作
            """.formatted(name);
    }

    @Override
    public AiAnalysisVO analyzePlot(Long plotId, String analysisType) {
        log.info("AI analysis started for plotId={}, type={}", plotId, analysisType);

        // Guard -1: 并发保护 — 同一地块同时只允许一个分析任务
        if (ANALYZING_PLOTS.putIfAbsent(plotId, Boolean.TRUE) != null) {
            log.info("AI analysis already in progress for plotId={}, returning latest", plotId);
            return getLatestAnalysis(plotId);
        }
        try {
            return doAnalyze(plotId, analysisType);
        } finally {
            ANALYZING_PLOTS.remove(plotId);
        }
    }

    private AiAnalysisVO doAnalyze(Long plotId, String analysisType) {
        // Guard 0: 分析限流 — 同一地块短时间内不重复分析
        AiAnalysisRecord lastRecord = analysisRecordMapper.selectOne(
                new LambdaQueryWrapper<AiAnalysisRecord>()
                        .eq(AiAnalysisRecord::getPlotId, plotId)
                        .orderByDesc(AiAnalysisRecord::getCreatedAt)
                        .last("LIMIT 1"));
        if (lastRecord != null && lastRecord.getCreatedAt() != null) {
            long minutesAgo = Duration.between(lastRecord.getCreatedAt(), LocalDateTime.now()).toMinutes();
            if (minutesAgo < MIN_ANALYSIS_INTERVAL_MINUTES) {
                log.info("AI analysis rate limited for plotId={}, last analysis {}min ago (min interval={}min)",
                        plotId, minutesAgo, MIN_ANALYSIS_INTERVAL_MINUTES);
                return getLatestAnalysis(plotId);
            }
        }

        // 1. 采集传感器数据 + 数据质量守卫
        List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getPlotId, plotId));
        SensorDataGuard.SensorQualityReport sensorReport = sensorDataGuard.evaluate(sensors);

        List<Map<String, Object>> sensorSnapshot = sensors.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sensorName", s.getSensorName());
            m.put("sensorType", s.getSensorType());
            m.put("value", s.getLastValue());
            m.put("unit", s.getUnit());
            m.put("status", s.getStatus());
            m.put("sampleAt", s.getLastSampleAt() != null ? s.getLastSampleAt().format(FMT) : null);
            return m;
        }).collect(Collectors.toList());

        // 2. 采集作物信息
        CropBatch crop = cropBatchMapper.selectOne(
                new LambdaQueryWrapper<CropBatch>()
                        .eq(CropBatch::getPlotId, plotId)
                        .eq(CropBatch::getBatchStatus, "active")
                        .last("LIMIT 1"));

        Plot plot = plotMapper.selectById(plotId);
        String cropInfo = "";
        if (crop != null) {
            cropInfo = String.format("作物:%s(%s) 生长阶段:%s 播种:%s 预计收获:%s 备注:%s 风险:%s",
                    crop.getCropName(), crop.getVarietyName(), crop.getGrowthStage(),
                    crop.getSowingAt() != null ? crop.getSowingAt().format(FMT) : "未知",
                    crop.getExpectedHarvestAt() != null ? crop.getExpectedHarvestAt().format(FMT) : "未知",
                    crop.getNextTask() != null ? crop.getNextTask() : "无",
                    crop.getRiskHint() != null ? crop.getRiskHint() : "无");
        }

        // 3. 构建分析 prompt（含数据质量警告）
        String plotName = plot != null ? plot.getPlotName() : "未知地块";
        StringBuilder userMsg = new StringBuilder();
        userMsg.append(String.format("【地块: %s (ID:%d)】\n", plotName, plotId));
        userMsg.append(String.format("【分析时间: %s】\n\n", LocalDateTime.now().format(FMT)));
        userMsg.append(sensorReport.toPromptText());

        userMsg.append("== 传感器实时数据 ==\n");
        for (Map<String, Object> s : sensorSnapshot) {
            userMsg.append(String.format("- %s [%s]: %s %s (采样: %s)\n",
                    s.get("sensorName"), s.get("status"), s.get("value"), s.get("unit"), s.get("sampleAt")));
        }

        userMsg.append("\n== 作物信息 ==\n");
        userMsg.append(cropInfo.isEmpty() ? "暂无作物批次信息" : cropInfo);

        // 4. 调用智谱 GLM
        String aiResponse = zhipuClient.chat(buildAnalysisPrompt(), userMsg.toString());

        // 5. 解析结果
        String analysisResult = "AI分析暂时不可用";
        String riskLevel = "low";
        List<String> suggestedActions = new ArrayList<>();

        if (aiResponse != null && !aiResponse.isBlank()) {
            try {
                String json = aiResponse.trim();
                if (json.startsWith("```")) {
                    json = json.replaceAll("```json\\s*", "").replaceAll("```\\s*$", "").trim();
                }
                Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
                analysisResult = (String) parsed.getOrDefault("analysisResult", aiResponse);
                riskLevel = (String) parsed.getOrDefault("riskLevel", "low");
                Object actions = parsed.get("suggestedActions");
                if (actions instanceof List<?> list) {
                    suggestedActions = list.stream().map(Object::toString).collect(Collectors.toList());
                }
            } catch (Exception e) {
                log.warn("Failed to parse AI analysis JSON, using raw text. error={}", e.getMessage());
                analysisResult = aiResponse;
            }
        }

        // 6. 存入数据库
        AiAnalysisRecord record = new AiAnalysisRecord();
        record.setPlotId(plotId);
        record.setAnalysisType(analysisType != null ? analysisType : "manual");
        record.setCropInfo(cropInfo);
        record.setAnalysisResult(analysisResult);
        record.setRiskLevel(riskLevel);
        try {
            record.setSensorSnapshot(objectMapper.writeValueAsString(sensorSnapshot));
            record.setSuggestedActions(objectMapper.writeValueAsString(suggestedActions));
        } catch (Exception e) {
            log.error("JSON serialize error", e);
        }
        record.setCreatedAt(LocalDateTime.now());
        analysisRecordMapper.insert(record);

        log.info("AI analysis completed for plotId={}, recordId={}, riskLevel={}", plotId, record.getId(), riskLevel);

        return toVO(record, sensorSnapshot, suggestedActions);
    }

    @Override
    public AiAnalysisVO getLatestAnalysis(Long plotId) {
        AiAnalysisRecord record = analysisRecordMapper.selectOne(
                new LambdaQueryWrapper<AiAnalysisRecord>()
                        .eq(AiAnalysisRecord::getPlotId, plotId)
                        .orderByDesc(AiAnalysisRecord::getCreatedAt)
                        .last("LIMIT 1"));
        if (record == null) return null;

        List<Map<String, Object>> snapshot = new ArrayList<>();
        List<String> actions = new ArrayList<>();
        try {
            if (record.getSensorSnapshot() != null) {
                snapshot = objectMapper.readValue(record.getSensorSnapshot(), new TypeReference<>() {});
            }
            if (record.getSuggestedActions() != null) {
                actions = objectMapper.readValue(record.getSuggestedActions(), new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.warn("JSON parse error", e);
        }
        return toVO(record, snapshot, actions);
    }

    private AiAnalysisVO toVO(AiAnalysisRecord r, List<Map<String, Object>> snapshot, List<String> actions) {
        AiAnalysisVO vo = new AiAnalysisVO();
        vo.setId(r.getId());
        vo.setPlotId(r.getPlotId());
        vo.setAnalysisType(r.getAnalysisType());
        vo.setSensorSnapshot(snapshot);
        vo.setCropInfo(r.getCropInfo());
        vo.setAnalysisResult(r.getAnalysisResult());
        vo.setRiskLevel(r.getRiskLevel());
        vo.setSuggestedActions(actions);
        vo.setCreatedAt(r.getCreatedAt() != null ? r.getCreatedAt().format(FMT) : null);
        return vo;
    }
}
