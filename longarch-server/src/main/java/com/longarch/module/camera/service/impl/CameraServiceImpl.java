package com.longarch.module.camera.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.config.MediaServerProperties;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.exception.BizException;
import com.longarch.module.adoption.entity.AdoptionCode;
import com.longarch.module.adoption.mapper.AdoptionCodeMapper;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.camera.entity.CameraDevice;
import com.longarch.module.camera.mapper.CameraDeviceMapper;
import com.longarch.module.camera.service.CameraService;
import com.longarch.module.camera.vo.CameraVO;
import com.longarch.module.camera.vo.LiveUrlVO;
import com.longarch.module.camera.vo.PlaybackUrlVO;
import com.longarch.module.camera.vo.SnapshotVO;
import cn.dev33.satoken.stp.StpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CameraServiceImpl implements CameraService {

    private final CameraDeviceMapper cameraDeviceMapper;
    private final AdoptionCodeMapper adoptionCodeMapper;
    private final AccessScopeService accessScopeService;
    private final MediaServerProperties mediaServer;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public List<CameraVO> getCameraList(Long plotId) {
        accessScopeService.checkFeatureAccess(plotId, "can_view_live");
        List<CameraDevice> devices = cameraDeviceMapper.selectList(
                new LambdaQueryWrapper<CameraDevice>().eq(CameraDevice::getPlotId, plotId));

        return devices.stream().map(d -> {
            CameraVO vo = new CameraVO();
            vo.setCameraId(d.getId());
            vo.setDeviceNo(d.getDeviceNo());
            vo.setCameraName(d.getCameraName());
            vo.setStreamProtocol(d.getStreamProtocol());
            vo.setPlaybackEnabled(d.getPlaybackEnabled() == 1);
            vo.setPtzEnabled(d.getPtzEnabled() == 1);
            vo.setMicEnabled(d.getMicEnabled() == 1);
            vo.setNetworkStatus(d.getNetworkStatus());
            vo.setDeviceStatus(d.getDeviceStatus());
            vo.setSnapshotUrl(buildSnapshotUrl(d));
            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    public LiveUrlVO getLiveUrl(Long cameraId) {
        CameraDevice device = cameraDeviceMapper.selectById(cameraId);
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "摄像头不存在");
        }
        accessScopeService.checkFeatureAccess(device.getPlotId(), "can_view_live");

        String app = device.getStreamApp() != null ? device.getStreamApp() : mediaServer.getLiveApp();
        String stream = device.getStreamName() != null ? device.getStreamName() : device.getDeviceNo();

        // HTTP-FLV 低延迟直播（前端用 flv.js 播放）
        String flvUrl = mediaServer.getHttpFlvBase() + "/" + app + "/" + stream + ".flv";
        // HLS 备用（兼容性好，延迟较高）
        String hlsUrl = mediaServer.getHlsBase() + "/" + app + "/" + stream + ".m3u8";

        LiveUrlVO vo = new LiveUrlVO();
        vo.setCameraId(cameraId);
        vo.setProtocol("rtmp");
        vo.setFlvUrl(flvUrl);
        vo.setHlsUrl(hlsUrl);
        vo.setExpireAt(LocalDateTime.now().plusHours(2).format(FMT));
        vo.setNetworkStatus(device.getNetworkStatus());

        LiveUrlVO.DegradeStrategy ds = new LiveUrlVO.DegradeStrategy();
        ds.setSupportsLowBitrate(true);
        ds.setSupportsSnapshotFallback(true);
        vo.setDegradeStrategy(ds);

        return vo;
    }

    @Override
    public PlaybackUrlVO getPlaybackUrl(Long cameraId, String startTime, String endTime) {
        CameraDevice device = cameraDeviceMapper.selectById(cameraId);
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "摄像头不存在");
        }
        accessScopeService.checkFeatureAccess(device.getPlotId(), "can_view_history");
        if (device.getPlaybackEnabled() != 1) {
            throw new BizException(ErrorCode.PLAYBACK_NOT_ALLOWED, "该摄像头不支持回放");
        }

        // 校验 history_days 限制
        enforceHistoryDaysLimit(device.getPlotId(), startTime);

        String app = mediaServer.getPlaybackApp();
        String stream = device.getStreamName() != null ? device.getStreamName() : device.getDeviceNo();

        // SRS DVR 回放 HLS 地址：/playback/{stream}-{startTime}-{endTime}.m3u8
        String playbackUrl = mediaServer.getHlsBase() + "/" + app + "/" + stream
                + "?start=" + startTime + "&end=" + endTime;

        PlaybackUrlVO vo = new PlaybackUrlVO();
        vo.setCameraId(cameraId);
        vo.setPlaybackUrl(playbackUrl);
        vo.setStartTime(startTime);
        vo.setEndTime(endTime);
        return vo;
    }

    @Override
    public SnapshotVO getSnapshot(Long cameraId) {
        CameraDevice device = cameraDeviceMapper.selectById(cameraId);
        if (device == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "摄像头不存在");
        }
        accessScopeService.checkFeatureAccess(device.getPlotId(), "can_view_live");

        SnapshotVO vo = new SnapshotVO();
        vo.setCameraId(cameraId);
        vo.setSnapshotUrl(buildSnapshotUrl(device));
        vo.setCapturedAt(LocalDateTime.now().format(FMT));
        return vo;
    }

    /**
     * 构建截图 URL：SRS API 截图地址
     * SRS 截图 API: {apiBase}/api/v1/snapshots?app={app}&stream={stream}
     */
    private String buildSnapshotUrl(CameraDevice device) {
        if (device.getSnapshotUrl() != null) {
            return device.getSnapshotUrl();
        }
        String app = device.getStreamApp() != null ? device.getStreamApp() : mediaServer.getLiveApp();
        String stream = device.getStreamName() != null ? device.getStreamName() : device.getDeviceNo();
        return mediaServer.getApiBase() + "/api/v1/snapshots?app=" + app + "&stream=" + stream;
    }

    /**
     * 校验回放时间范围不超过用户认养码的 history_days 限制
     */
    private void enforceHistoryDaysLimit(Long plotId, String startTime) {
        Long userId = StpUtil.getLoginIdAsLong();
        AdoptionCode code = adoptionCodeMapper.selectOne(
                new LambdaQueryWrapper<AdoptionCode>()
                        .eq(AdoptionCode::getBindUserId, userId)
                        .eq(AdoptionCode::getPlotId, plotId)
                        .eq(AdoptionCode::getStatus, "active")
                        .last("LIMIT 1"));
        if (code == null) {
            return; // checkFeatureAccess 已经做过权限校验，这里不重复抛异常
        }

        int historyDays = code.getHistoryDays() != null ? code.getHistoryDays() : 7;
        LocalDateTime requestStart = LocalDateTime.parse(startTime, FMT);
        LocalDateTime earliestAllowed = LocalDateTime.now().minusDays(historyDays);

        if (requestStart.isBefore(earliestAllowed)) {
            throw new BizException(ErrorCode.ACTION_NOT_ALLOWED,
                    "回放范围超出权限限制，最多可回看 " + historyDays + " 天");
        }
    }
}
