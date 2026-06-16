package com.longarch.module.screen.service;

import com.longarch.module.screen.vo.EnvHistoryVO;
import com.longarch.module.screen.vo.GreenhouseListVO;
import com.longarch.module.screen.vo.ScreenOverviewVO;

public interface ScreenService {

    ScreenOverviewVO getOverview(String screenToken, Long greenhouseId);

    EnvHistoryVO getEnvHistory(String screenToken, Long greenhouseId, int limit);

    GreenhouseListVO getGreenhouses(String screenToken);
}
