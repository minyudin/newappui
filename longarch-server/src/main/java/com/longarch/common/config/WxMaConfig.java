package com.longarch.common.config;

import cn.binarywang.wx.miniapp.api.WxMaService;
import cn.binarywang.wx.miniapp.api.impl.WxMaServiceImpl;
import cn.binarywang.wx.miniapp.config.impl.WxMaDefaultConfigImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 微信小程序 SDK Bean 装配 · weixin-java-miniapp
 * ============================================================
 *  无论 stub-mode 真假, 都 build 一个 WxMaService bean:
 *   · stub-mode=true 且 appId 占位      · bean 仍存在, 不会被调到, 启动也不报错
 *   · stub-mode=false                   · AuthServiceImpl.resolveOpenId 调
 *                                         WxMaService.getUserService().getSessionInfo(code)
 *
 *  设计取舍:
 *   · 不用 @ConditionalOnProperty(stubMode=false) · 因为 dev 切换 stub 开关时
 *     不希望 Spring 重启容器 (live-reload 体验), bean 总有不会出错
 *   · 真正的"是否调用微信"逻辑放在 AuthServiceImpl 内分支判断, 单点收口
 * ============================================================ */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class WxMaConfig {

    private final WechatMiniProperties wechatMiniProperties;

    @Bean
    public WxMaService wxMaService() {
        WxMaDefaultConfigImpl config = new WxMaDefaultConfigImpl();
        // 占位也照塞, weixin-java-miniapp 不在 init 阶段校验真实性
        config.setAppid(safe(wechatMiniProperties.getAppId(), "wx_stub_appid"));
        config.setSecret(safe(wechatMiniProperties.getAppSecret(), "wx_stub_secret"));

        WxMaService service = new WxMaServiceImpl();
        service.setWxMaConfig(config);

        if (wechatMiniProperties.hasRealCredentials()) {
            log.info("WxMaService initialized with real credentials, appId={}",
                    maskAppId(wechatMiniProperties.getAppId()));
        } else {
            log.warn("WxMaService initialized with stub/placeholder credentials, " +
                    "real wechat code2session will NOT work; stubMode={}",
                    wechatMiniProperties.isStubMode());
        }
        return service;
    }

    private String safe(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    /** 日志脱敏: 只露前 4 位 + 后 4 位 · wx12***5cd6 */
    private String maskAppId(String appId) {
        if (appId == null || appId.length() < 10) return "***";
        return appId.substring(0, 4) + "***" + appId.substring(appId.length() - 4);
    }
}
