package com.longarch.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 微信小程序配置 · wechat.miniapp.*
 * ============================================================
 *  集中收口三个原本散落的 @Value 字段:
 *   · wechat.miniapp.app-id     · 小程序 AppID
 *   · wechat.miniapp.app-secret · 小程序 AppSecret
 *   · wechat.miniapp.stub-mode  · 离线 stub 模式 (true 跳过 code2session)
 *
 *  用法:
 *   · dev 联调本地:        stub-mode=true  · 或填真 appId 走 code2session
 *   · 生产环境:            stub-mode=false · 必须配真 appId/appSecret
 *                           ProductionStartupGuard 会校验, 不通过直接拒启
 *  环境变量覆盖:
 *   · WX_APP_ID / WX_APP_SECRET     (prod 必备)
 *   · WX_MINIAPP_STUB_MODE=false    (生产硬关)
 * ============================================================ */
@Data
@Component
@ConfigurationProperties(prefix = "wechat.miniapp")
public class WechatMiniProperties {

    /** 小程序 AppID · 形如 wx_xxxxxxxxxxxxxxx · stub 占位用 wx_stub_appid */
    private String appId;

    /** 小程序 AppSecret · 32 位 · 永不写入仓库 · 仅 env 注入 */
    private String appSecret;

    /**
     * 离线 stub 模式
     *  · true  · /auth/wechat-login 不调微信, 直接 openId = "stub_" + code
     *  · false · 必须能成功 code2session, 否则 wechatLogin 抛 INVALID_TOKEN
     */
    private boolean stubMode = false;

    /**
     * stub 模式 · 是否给新用户自动填上"用户XXXXXX"格式昵称, 跳过强制补昵称环节.
     *  · true  · e2e/CI 默认开, 避免 stub 流程被强制补昵称页打断
     *  · false · dev 联调若想体验完整真实流程, 关掉这个开关让 nickname 落 NULL
     *  · 真模式下此开关被忽略, 始终走强制补昵称
     */
    private boolean autoFillStubNickname = true;

    /** 是否填了真实 appId/secret · 启动日志判断 + 配置守卫用 */
    public boolean hasRealCredentials() {
        return appId != null
                && !appId.isBlank()
                && !appId.startsWith("wx_stub")
                && appSecret != null
                && !appSecret.isBlank()
                && !appSecret.startsWith("wx_stub");
    }
}
