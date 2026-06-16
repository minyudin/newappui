package com.longarch.module.camera.controller;

import com.longarch.common.result.R;
import com.longarch.module.camera.service.CameraService;
import com.longarch.module.camera.vo.CameraVO;
import com.longarch.module.camera.vo.LiveUrlVO;
import com.longarch.module.camera.vo.PlaybackUrlVO;
import com.longarch.module.camera.vo.SnapshotVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "视频监控")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CameraController {

    private final CameraService cameraService;

    @Operation(summary = "API-13 获取摄像头列表")
    @GetMapping("/plots/{plotId}/cameras")
    public R<List<CameraVO>> cameraList(@PathVariable Long plotId) {
        return R.ok(cameraService.getCameraList(plotId));
    }

    @Operation(summary = "API-14 获取实时流地址")
    @GetMapping("/cameras/{cameraId}/live-url")
    public R<LiveUrlVO> liveUrl(@PathVariable Long cameraId) {
        return R.ok(cameraService.getLiveUrl(cameraId));
    }

    @Operation(summary = "API-15 获取历史回放地址")
    @GetMapping("/cameras/{cameraId}/playback-url")
    public R<PlaybackUrlVO> playbackUrl(
            @PathVariable Long cameraId,
            @RequestParam String startTime,
            @RequestParam String endTime) {
        return R.ok(cameraService.getPlaybackUrl(cameraId, startTime, endTime));
    }

    @Operation(summary = "API-16 获取截图")
    @GetMapping("/cameras/{cameraId}/snapshot")
    public R<SnapshotVO> snapshot(@PathVariable Long cameraId) {
        return R.ok(cameraService.getSnapshot(cameraId));
    }
}
