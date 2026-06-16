package com.longarch.module.ai.service;

import com.longarch.module.ai.vo.AiAnalysisVO;

public interface AiAnalysisService {

    /**
     * 对指定地块执行一次AI数据分析
     * @param analysisType "manual" 手动触发 / "periodic" 定时触发
     */
    AiAnalysisVO analyzePlot(Long plotId, String analysisType);

    /**
     * 获取地块最新的AI分析记录
     */
    AiAnalysisVO getLatestAnalysis(Long plotId);
}
