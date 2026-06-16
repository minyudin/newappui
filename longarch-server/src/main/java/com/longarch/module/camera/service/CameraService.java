package com.longarch.module.camera.service;

import com.longarch.module.camera.vo.CameraVO;
import com.longarch.module.camera.vo.LiveUrlVO;
import com.longarch.module.camera.vo.PlaybackUrlVO;
import com.longarch.module.camera.vo.SnapshotVO;

import java.util.List;

public interface CameraService {

    List<CameraVO> getCameraList(Long plotId);

    LiveUrlVO getLiveUrl(Long cameraId);

    PlaybackUrlVO getPlaybackUrl(Long cameraId, String startTime, String endTime);

    SnapshotVO getSnapshot(Long cameraId);
}
