-- 测试数据
USE longarch;

INSERT INTO plot (id, plot_no, plot_name, farm_id, farm_name, area_size, area_unit, longitude, latitude, plot_status, intro_text) VALUES
(1, 'PLOT-A01', 'A区·阳光番茄园', 1, '陇上基地', 2.50, 'mu', 103.83420000, 36.06110000, 'active', '向阳坡地，日照充足，适合番茄生长'),
(2, 'PLOT-B02', 'B区·麦浪田', 1, '陇上基地', 5.00, 'mu', 103.83550000, 36.06230000, 'active', '平整良田，冬小麦轮作区'),
(3, 'PLOT-C03', 'C区·香草园', 1, '陇上基地', 1.20, 'mu', 103.83610000, 36.05980000, 'active', '小而美的香草种植区')
ON DUPLICATE KEY UPDATE plot_name=VALUES(plot_name);

INSERT INTO crop_batch (id, batch_no, plot_id, crop_name, variety_name, growth_stage, batch_status, sowing_at, expected_harvest_at, next_task, risk_hint) VALUES
(1, 'BATCH-2026-001', 1, '番茄', '普罗旺斯', 'fruiting', 'active', '2026-03-15 08:00:00', '2026-07-30 08:00:00', '疏果并补充钾肥', '近期高温注意遮阳'),
(2, 'BATCH-2026-002', 2, '小麦', '陇春35号', 'grain_filling', 'active', '2026-03-01 08:00:00', '2026-08-10 08:00:00', '灌浆期保持水分', NULL),
(3, 'BATCH-2026-003', 3, '罗勒', '甜罗勒', 'growing', 'active', '2026-05-01 08:00:00', '2026-08-01 08:00:00', '每周采收嫩叶', NULL)
ON DUPLICATE KEY UPDATE crop_name=VALUES(crop_name);

INSERT INTO sensor_device (id, device_no, sensor_name, plot_id, sensor_type, category, unit, status, `last_value`, last_sample_at) VALUES
(1, 'SEN-A01-TEMP', '空气温度计', 1, 'air_temperature', 'environment', '°C', 'online', 26.40, NOW()),
(2, 'SEN-A01-HUMI', '空气湿度计', 1, 'air_humidity', 'environment', '%', 'online', 58.20, NOW()),
(3, 'SEN-A01-SOIL', '土壤墒情仪', 1, 'soil_moisture', 'soil', '%', 'online', 41.50, NOW()),
(4, 'SEN-A01-LIGHT', '光照计', 1, 'light_intensity', 'environment', 'lux', 'online', 35200.00, NOW()),
(5, 'SEN-B02-TEMP', '空气温度计', 2, 'air_temperature', 'environment', '°C', 'online', 25.10, NOW()),
(6, 'SEN-B02-SOIL', '土壤墒情仪', 2, 'soil_moisture', 'soil', '%', 'online', 38.00, NOW()),
(7, 'SEN-C03-TEMP', '空气温度计', 3, 'air_temperature', 'environment', '°C', 'offline', 24.30, DATE_SUB(NOW(), INTERVAL 6 HOUR))
ON DUPLICATE KEY UPDATE sensor_name=VALUES(sensor_name);

-- 7 天每小时历史数据
INSERT INTO sensor_data (sensor_id, plot_id, sensor_type, value, sample_at)
WITH RECURSIVE hours(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM hours WHERE n < 167)
SELECT s.id, s.plot_id, s.sensor_type,
  ROUND(CASE s.sensor_type
    WHEN 'air_temperature' THEN 22 + 6*SIN(((n % 24)-6)*PI()/12) + RAND()*1.5
    WHEN 'air_humidity'    THEN 60 - 12*SIN(((n % 24)-6)*PI()/12) + RAND()*4
    WHEN 'soil_moisture'   THEN 40 + 4*SIN(n*PI()/84) + RAND()*2
    ELSE 20000 + 20000*GREATEST(SIN(((n % 24)-6)*PI()/12),0) + RAND()*1500
  END, 2),
  DATE_SUB(NOW(), INTERVAL n HOUR)
FROM sensor_device s CROSS JOIN hours;

INSERT INTO camera_device (id, device_no, camera_name, plot_id, stream_protocol, ptz_enabled, network_status, device_status, stream_app, stream_name) VALUES
(1, 'CAM-A01-01', 'A区全景摄像头', 1, 'flv', 1, 'online', 'online', 'live', 'cam-a01-01'),
(2, 'CAM-A01-02', 'A区特写摄像头', 1, 'flv', 0, 'online', 'online', 'live', 'cam-a01-02'),
(3, 'CAM-B02-01', 'B区全景摄像头', 2, 'flv', 1, 'online', 'online', 'live', 'cam-b02-01')
ON DUPLICATE KEY UPDATE camera_name=VALUES(camera_name);

INSERT INTO actuator_device (id, device_no, device_name, plot_id, device_type, device_status, edge_node_no, network_status, last_heartbeat_at) VALUES
(1, 'ACT-A01-IRR', 'A区滴灌阀', 1, 'irrigator', 'idle', 'EDGE-01', 'online', NOW()),
(2, 'ACT-A01-FER', 'A区施肥机', 1, 'fertilizer', 'idle', 'EDGE-01', 'online', NOW()),
(3, 'ACT-B02-IRR', 'B区喷灌泵', 2, 'irrigator', 'idle', 'EDGE-01', 'online', NOW())
ON DUPLICATE KEY UPDATE device_name=VALUES(device_name);

INSERT INTO edge_node (id, node_no, farm_id, node_name, hardware_type, network_status, health_status, last_heartbeat_at) VALUES
(1, 'EDGE-01', 1, '基地边缘网关1号', 'RaspberryPi-4B', 'online', 'healthy', NOW())
ON DUPLICATE KEY UPDATE node_name=VALUES(node_name);

INSERT INTO adoption_order (id, order_no, user_id, plot_id, crop_batch_id, adoption_type, order_status, start_at, end_at, payable_amount, pay_status, remark) VALUES
(1, 'ORD-2026-0001', NULL, 1, 1, 'plot_crop', 'active', '2026-04-01 00:00:00', '2026-12-31 23:59:59', 1288.00, 'paid', '番茄园认养·全年'),
(2, 'ORD-2026-0002', NULL, 2, 2, 'plot_crop', 'active', '2026-04-01 00:00:00', '2026-12-31 23:59:59', 888.00, 'paid', '麦田认养·全年')
ON DUPLICATE KEY UPDATE remark=VALUES(remark);

INSERT INTO adoption_code (id, code, code_type, order_id, plot_id, crop_batch_id, status, valid_from, valid_to, can_view_live, can_view_history, history_days, can_view_sensor, can_operate, max_daily_operations, shareable) VALUES
(1, 'LONG-TOMATO-2026', 'master', 1, 1, 1, 'active', '2026-04-01 00:00:00', '2026-12-31 23:59:59', 1, 1, 30, 1, 1, 5, 1),
(2, 'LONG-WHEAT-2026', 'master', 2, 2, 2, 'active', '2026-04-01 00:00:00', '2026-12-31 23:59:59', 1, 1, 30, 1, 1, 5, 1)
ON DUPLICATE KEY UPDATE status=VALUES(status);

INSERT INTO farming_record (plot_id, crop_batch_id, record_type, record_title, operator_name, record_time, description) VALUES
(1, 1, 'irrigation', '滴灌 30 分钟', '张师傅', DATE_SUB(NOW(), INTERVAL 1 DAY), '例行灌溉，土壤墒情恢复至 42%'),
(1, 1, 'fertilization', '追施钾肥', '张师傅', DATE_SUB(NOW(), INTERVAL 3 DAY), '结果期补钾，促进果实膨大'),
(1, 1, 'pruning', '整枝打杈', '李师傅', DATE_SUB(NOW(), INTERVAL 5 DAY), '去除侧枝，改善通风'),
(2, 2, 'irrigation', '喷灌 45 分钟', '王师傅', DATE_SUB(NOW(), INTERVAL 2 DAY), '灌浆期补水'),
(2, 2, 'inspection', '田间巡查', '王师傅', DATE_SUB(NOW(), INTERVAL 4 DAY), '长势良好，无病虫害'),
(3, 3, 'harvest', '采收嫩叶 2kg', '李师傅', DATE_SUB(NOW(), INTERVAL 1 DAY), '第 4 次采收');

INSERT INTO ai_analysis_record (plot_id, analysis_type, sensor_snapshot, crop_info, analysis_result, risk_level, suggested_actions) VALUES
(1, 'periodic', '{"air_temperature":26.4,"air_humidity":58.2,"soil_moisture":41.5}', '番茄·普罗旺斯·结果期', '当前温湿度适宜，土壤墒情良好。预计未来三天气温升高，建议午间适当遮阳并保持灌溉频率。', 'low', '["保持每日滴灌","午间遮阳"]'),
(2, 'periodic', '{"air_temperature":25.1,"soil_moisture":38.0}', '小麦·陇春35号·灌浆期', '土壤墒情略低于灌浆期理想区间(40-45%)，建议今明两天各补灌一次。', 'medium', '["补灌 45 分钟","持续监测墒情"]');
