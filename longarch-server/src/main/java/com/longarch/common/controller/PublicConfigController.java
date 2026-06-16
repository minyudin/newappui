package com.longarch.common.controller;

import com.longarch.common.config.BusinessDefaultsProperties;
import com.longarch.common.result.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicConfigController {

    private final BusinessDefaultsProperties bizDefaults;

    @GetMapping("/config")
    public R<Map<String, String>> platformConfig() {
        return R.ok(Map.of(
                "platformName", bizDefaults.getPlatformName(),
                "dashboardTitle", bizDefaults.getDashboardTitle(),
                "dashboardSubtitle", bizDefaults.getDashboardSubtitle()
        ));
    }
}
