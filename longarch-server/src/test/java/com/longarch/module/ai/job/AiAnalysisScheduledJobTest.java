package com.longarch.module.ai.job;

import com.longarch.module.ai.mapper.AiAnalysisRecordMapper;
import com.longarch.module.ai.service.AiAnalysisService;
import com.longarch.module.plot.entity.Plot;
import com.longarch.module.plot.mapper.PlotMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiAnalysisScheduledJobTest {

    @Mock
    private PlotMapper plotMapper;
    @Mock
    private AiAnalysisService aiAnalysisService;
    @Mock
    private AiAnalysisRecordMapper analysisRecordMapper;

    @InjectMocks
    private AiAnalysisScheduledJob job;

    private List<Plot> plots(int n) {
        List<Plot> list = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            Plot p = new Plot();
            p.setId((long) i);
            p.setPlotName("plot-" + i);
            list.add(p);
        }
        return list;
    }

    @Test
    void disabled_shouldNotTouchDatabase() {
        ReflectionTestUtils.setField(job, "enabled", false);
        ReflectionTestUtils.setField(job, "maxPlotsPerRun", 50);

        job.executeAnalysis();

        verifyNoInteractions(plotMapper, aiAnalysisService, analysisRecordMapper);
    }

    @Test
    void shouldCapPlotsAnalyzedPerRun() {
        ReflectionTestUtils.setField(job, "enabled", true);
        ReflectionTestUtils.setField(job, "maxPlotsPerRun", 1);
        when(plotMapper.selectList(any())).thenReturn(plots(3));

        job.executeAnalysis();

        // 3 个活跃地块、单轮上限 1 → 只分析 1 个，其余下轮处理
        verify(aiAnalysisService, times(1)).analyzePlot(anyLong(), anyString());
    }

    @Test
    void shouldAnalyzeAllPlotsWhenUnderCap() {
        ReflectionTestUtils.setField(job, "enabled", true);
        ReflectionTestUtils.setField(job, "maxPlotsPerRun", 50);
        when(plotMapper.selectList(any())).thenReturn(plots(2));

        job.executeAnalysis();

        // 2 个活跃地块、上限 50 → 全部分析
        verify(aiAnalysisService, times(2)).analyzePlot(anyLong(), anyString());
    }
}
