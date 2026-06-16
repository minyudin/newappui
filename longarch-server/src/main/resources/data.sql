-- 测试数据初始化脚本
-- 使用前请先执行 schema.sql 建表

USE longarch;

-- 1. 测试用户（正常通过微信登录自动创建，此处预置管理员和农技人员）
INSERT INTO `user` (id, user_no, open_id, nickname, real_name, mobile, role_type, status, bind_mobile) VALUES
(1, 'U100001', 'admin_openid', '管理员', '张管理', '13800000001', 'admin', 1, 1),
(2, 'U100002', 'operator_openid', '运营人员', '李运营', '13800000002', 'operator', 1, 1),
(3, 'U100003', 'stub_test_code_001', '测试用户A', '王认养', '13800000003', 'adopter', 1, 1);

-- 2. 地块
INSERT INTO `plot` (id, plot_no, plot_name, farm_id, farm_name, area_size, area_unit, longitude, latitude, plot_status, live_cover_url, intro_text) VALUES
(30001, 'PLOT-A001', 'A区1号田', 1, '陇上基地', 2.50, 'mu', 104.065735, 35.731164, 'active', 'https://cdn.stub.com/plot-a001-cover.jpg', '位于陇上基地东侧，土壤肥沃，适合种植小麦和土豆'),
(30002, 'PLOT-A002', 'A区2号田', 1, '陇上基地', 3.00, 'mu', 104.066000, 35.731200, 'active', 'https://cdn.stub.com/plot-a002-cover.jpg', '位于陇上基地西侧，日照充足');

-- 3. 作物批次
INSERT INTO `crop_batch` (id, batch_no, plot_id, crop_name, variety_name, growth_stage, batch_status, sowing_at, expected_harvest_at, next_task, risk_hint) VALUES
(50001, 'CB-2026-A001-01', 30001, '冬小麦', '陇春27号', 'heading', 'active', '2025-10-15 08:00:00', '2026-06-20 08:00:00', '即将进入灌浆期，需注意灌溉', '近期气温偏高，注意防旱'),
(50002, 'CB-2026-A002-01', 30002, '马铃薯', '陇薯7号', 'tuber_growth', 'active', '2026-03-01 08:00:00', '2026-07-15 08:00:00', '块茎膨大期，需追施钾肥', NULL);

-- 4. 认养订单
INSERT INTO `adoption_order` (id, order_no, user_id, plot_id, crop_batch_id, adoption_type, order_status, start_at, end_at, visibility_level, operation_level) VALUES
(20001, 'AO-2026-00001', 3, 30001, 50001, 'plot_crop', 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'full', 'request_only'),
(20002, 'AO-2026-00002', NULL, 30002, 50002, 'plot_crop', 'pending', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'full', 'request_only');

-- 5. 认养码
INSERT INTO `adoption_code` (id, code, code_type, order_id, plot_id, crop_batch_id, bind_user_id, status, valid_from, valid_to, daily_access_start, daily_access_end, can_view_live, can_view_history, history_days, can_view_sensor, can_operate, operation_whitelist, max_daily_operations, shareable) VALUES
(10001, 'LSGJ-MASTER-001', 'master', 20001, 30001, 50001, 3, 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', '06:00:00', '23:00:00', 1, 1, 30, 1, 1, '["irrigation_apply","fertilize_apply","spray_apply"]', 5, 1),
(10002, 'LSGJ-GUEST-001', 'guest', 20001, 30001, 50001, NULL, 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', '08:00:00', '22:00:00', 1, 0, 0, 1, 0, '[]', 0, 0),
(10003, 'LSGJ-MASTER-002', 'master', 20002, 30002, 50002, NULL, 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', '06:00:00', '23:00:00', 1, 1, 30, 1, 1, '["irrigation_apply","fertilize_apply"]', 3, 0);

-- 6. 摄像头
INSERT INTO `camera_device` (id, device_no, camera_name, plot_id, stream_protocol, playback_enabled, ptz_enabled, mic_enabled, network_status, device_status, snapshot_url) VALUES
(60001, 'CAM-A001-01', 'A区1号田全景摄像头', 30001, 'webrtc', 1, 1, 0, 'online', 'online', 'https://cdn.stub.com/snapshot-a001-01.jpg'),
(60002, 'CAM-A001-02', 'A区1号田近景摄像头', 30001, 'webrtc', 1, 0, 0, 'online', 'online', 'https://cdn.stub.com/snapshot-a001-02.jpg'),
(60003, 'CAM-A002-01', 'A区2号田全景摄像头', 30002, 'webrtc', 1, 0, 0, 'online', 'online', 'https://cdn.stub.com/snapshot-a002-01.jpg');

-- 7. 传感器设备
INSERT INTO `sensor_device` (`id`, `device_no`, `sensor_name`, `plot_id`, `sensor_type`, `unit`, `status`, `last_value`, `last_sample_at`) VALUES
(70001, 'SENSOR-A001-TEMP', '土壤温度传感器', 30001, 'soil_temperature', '℃', 'online', 18.50, '2026-04-14 20:00:00'),
(70002, 'SENSOR-A001-HUMI', '土壤湿度传感器', 30001, 'soil_humidity', '%', 'online', 45.20, '2026-04-14 20:00:00'),
(70003, 'SENSOR-A001-PH', '土壤pH传感器', 30001, 'soil_ph', 'pH', 'online', 6.80, '2026-04-14 20:00:00'),
(70004, 'SENSOR-A001-AIR', '空气温湿度传感器', 30001, 'air_temperature', '℃', 'online', 22.30, '2026-04-14 20:00:00'),
(70005, 'SENSOR-A002-TEMP', '土壤温度传感器', 30002, 'soil_temperature', '℃', 'online', 17.80, '2026-04-14 20:00:00');

-- 8. 传感器历史数据（模拟最近几小时）
INSERT INTO `sensor_data` (sensor_id, plot_id, sensor_type, value, sample_at) VALUES
(70001, 30001, 'soil_temperature', 17.20, '2026-04-14 14:00:00'),
(70001, 30001, 'soil_temperature', 17.80, '2026-04-14 15:00:00'),
(70001, 30001, 'soil_temperature', 18.10, '2026-04-14 16:00:00'),
(70001, 30001, 'soil_temperature', 18.30, '2026-04-14 17:00:00'),
(70001, 30001, 'soil_temperature', 18.50, '2026-04-14 18:00:00'),
(70001, 30001, 'soil_temperature', 18.40, '2026-04-14 19:00:00'),
(70001, 30001, 'soil_temperature', 18.50, '2026-04-14 20:00:00'),
(70002, 30001, 'soil_humidity', 42.00, '2026-04-14 14:00:00'),
(70002, 30001, 'soil_humidity', 43.50, '2026-04-14 16:00:00'),
(70002, 30001, 'soil_humidity', 44.80, '2026-04-14 18:00:00'),
(70002, 30001, 'soil_humidity', 45.20, '2026-04-14 20:00:00');

-- 9. 执行设备（浇水、施肥）
INSERT INTO `actuator_device` (id, device_no, device_name, plot_id, device_type, device_status, edge_node_no) VALUES
(80001, 'ACT-A001-IRR', 'A区1号田浇水设备', 30001, 'irrigator', 'idle', 'EDGE-001'),
(80002, 'ACT-A001-FERT', 'A区1号田施肥设备', 30001, 'fertilizer', 'idle', 'EDGE-001'),
(80003, 'ACT-A002-IRR', 'A区2号田浇水设备', 30002, 'irrigator', 'idle', 'EDGE-001');

-- 10. 设备锁（初始化为free）
INSERT INTO `device_lock` (device_id, lock_status) VALUES
(80001, 'free'),
(80002, 'free'),
(80003, 'free');

-- 11. 农事记录
INSERT INTO `farming_record` (plot_id, crop_batch_id, record_type, record_title, operator_name, record_time, description) VALUES
(30001, 50001, 'sowing', '播种冬小麦', '李运营', '2025-10-15 09:00:00', '使用陇春27号品种，每亩播种量15公斤'),
(30001, 50001, 'irrigation', '越冬灌溉', '李运营', '2025-12-01 10:00:00', '越冬前灌足底墒水，每亩灌水60方'),
(30001, 50001, 'fertilize', '返青追肥', '李运营', '2026-03-05 08:30:00', '每亩追施尿素10公斤'),
(30001, 50001, 'pest_control', '蚜虫防治', '王农技', '2026-04-01 14:00:00', '发现少量蚜虫，喷施吡虫啉'),
(30002, 50002, 'sowing', '播种马铃薯', '李运营', '2026-03-01 09:00:00', '使用陇薯7号，切块催芽后播种');

-- 12. 边缘节点
INSERT INTO `edge_node` (id, node_no, farm_id, node_name, hardware_type, os_version, runtime_version, network_status, health_status, local_storage_free_mb, last_heartbeat_at) VALUES
(1, 'EDGE-001', 1, '陇上基地边缘节点01', 'RK3588', 'Ubuntu 22.04', 'Java 17', 'online', 'healthy', 32000, '2026-04-14 20:50:00');
