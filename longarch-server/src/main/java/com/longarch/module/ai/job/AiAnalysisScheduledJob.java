package com.longarch.module.ai.job;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.module.ai.entity.AiAnalysisRecord;
import com.longarch.module.ai.mapper.AiAnalysisRecordMapper;
import com.longarch.module.ai.service.AiAnalysisService;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.PlotMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * AI 定时数据分析任务
 * 周期性扫描所有活跃地块，逐个触发 AI 分析，生成建议存入数据库。
 * 配置项：
 *   ai.scheduled-analysis.enabled            — 总开关（默认关）
 *   ai.scheduled-analysis.cron               — cron 表达式
 *   ai.scheduled-analysis.max-plots-per-run  — 单次最多分析地块数（防小服务器一轮跑爆）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiAnalysisScheduledJob {

    private final PlotMapper plotMapper;
    private final AiAnalysisService aiAnalysisService;
    private final AiAnalysisRecordMapper analysisRecordMapper;

    private static final int MAX_RECORDS_PER_PLOT = 30;

    @Value("${ai.scheduled-analysis.enabled:false}")
    private boolean enabled;

    /** 单轮最多分析的地块数，0/负数表示不限制。默认 50，避免地块多时一轮长时间占用 CPU/外网 IO。 */
    @Value("${ai.scheduled-analysis.max-plots-per-run:50}")
    private int maxPlotsPerRun;

    @Scheduled(cron = "${ai.scheduled-analysis.cron:0 0 6,12,18 * * ?}")
    public void executeAnalysis() {
        if (!enabled) {
            log.debug("AI scheduled analysis is disabled, skipping");
            return;
        }

        log.info("========== AI 定时分析任务开始 ==========");
        long startTime = System.currentTimeMillis();

        // 查询所有活跃地块
        List<Plot> activePlots = plotMapper.selectList(
                new LambdaQueryWrapper<Plot>()
                        .eq(Plot::getPlotStatus, "active"));

        if (activePlots.isEmpty()) {
            log.info("没有活跃地块，跳过分析");
            return;
        }

        int total = activePlots.size();
        if (maxPlotsPerRun > 0 && total > maxPlotsPerRun) {
            log.warn("活跃地块 {} 个超过单轮上限 {}，本轮只分析前 {} 个，其余下轮处理",
                    total, maxPlotsPerRun, maxPlotsPerRun);
            activePlots = activePlots.subList(0, maxPlotsPerRun);
        }
        log.info("发现 {} 个活跃地块，本轮分析 {} 个", total, activePlots.size());

        int successCount = 0;
        int failCount = 0;

        for (Plot plot : activePlots) {
            try {
                log.info("分析地块: {} (ID:{})", plot.getPlotName(), plot.getId());
                aiAnalysisService.analyzePlot(plot.getId(), "periodic");
                successCount++;
            } catch (Exception e) {
                failCount++;
                log.error("地块 {} (ID:{}) 分析失败: {}", plot.getPlotName(), plot.getId(), e.getMessage(), e);
            }

            // 地块间间隔 2 秒，避免 API 限流
            try {
                Thread.sleep(2000);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("========== AI 定时分析任务完成: 成功={}, 失败={}, 耗时={}ms ==========",
                successCount, failCount, elapsed);

        // 清理过旧记录：每个地块保留最新 N 条
        cleanupOldRecords(activePlots);
    }

    private void cleanupOldRecords(List<Plot> plots) {
        int totalDeleted = 0;
        for (Plot plot : plots) {
            try {
                // 只查「超出最新 N 条」之外的待删 id（select id + LIMIT offset），
                // 不再把整表记录全行拉进内存——记录多时省内存、省网络传输。
                List<AiAnalysisRecord> stale = analysisRecordMapper.selectList(
                        new LambdaQueryWrapper<AiAnalysisRecord>()
                                .select(AiAnalysisRecord::getId)
                                .eq(AiAnalysisRecord::getPlotId, plot.getId())
                                .orderByDesc(AiAnalysisRecord::getCreatedAt)
                                .last("LIMIT " + MAX_RECORDS_PER_PLOT + ", " + Integer.MAX_VALUE));
                if (!stale.isEmpty()) {
                    List<Long> idsToDelete = stale.stream().map(AiAnalysisRecord::getId).toList();
                    analysisRecordMapper.deleteBatchIds(idsToDelete);
                    totalDeleted += idsToDelete.size();
                }
            } catch (Exception e) {
                log.warn("清理地块 {} 分析记录失败: {}", plot.getId(), e.getMessage());
            }
        }
        if (totalDeleted > 0) {
            log.info("清理过旧分析记录: 共删除 {} 条", totalDeleted);
        }
    }
}
