-- 测试基础数据

-- admin 用户
INSERT INTO `user` (`id`, `user_no`, `open_id`, `nickname`, `real_name`, `role_type`, `status`, `bind_mobile`) VALUES
(1, 'U000001', 'admin_openid', '管理员', '张管理', 'admin', 1, 0),
(2, 'U000002', 'adopter_openid', '认养用户', '李认养', 'adopter', 1, 0),
(3, 'U000003', 'operator_openid', '运营人员', '王运营', 'operator', 1, 0),
(4, 'U000004', 'agronomist_openid', '农技人员', '赵农技', 'agronomist', 1, 0);

-- 地块
INSERT INTO `plot` (`id`, `plot_no`, `plot_name`, `farm_id`, `farm_name`, `plot_status`) VALUES
(1, 'PLOT-001', '测试地块A', 1, '陇上基地', 'active'),
(2, 'PLOT-002', '测试地块B', 1, '陇上基地', 'active');

-- 作物批次
INSERT INTO `crop_batch` (`id`, `batch_no`, `plot_id`, `crop_name`, `variety_name`, `growth_stage`, `batch_status`, `risk_hint`) VALUES
(1, 'CB-001', 1, '苹果', '红富士', 'flowering', 'active', '注意倒春寒'),
(2, 'CB-002', 2, '小麦', '陇春35', 'tillering', 'active', NULL);

-- 认养订单
INSERT INTO `adoption_order` (`id`, `order_no`, `user_id`, `plot_id`, `crop_batch_id`, `order_status`, `start_at`, `end_at`, `pay_status`, `created_by`) VALUES
(1, 'AO-001', 2, 1, 1, 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'paid', 1);

-- 认养码（master + guest）
INSERT INTO `adoption_code` (`id`, `code`, `code_type`, `order_id`, `plot_id`, `crop_batch_id`, `bind_user_id`, `status`, `valid_from`, `valid_to`, `can_operate`, `can_view_history`, `can_view_sensor`) VALUES
(1, 'MASTER-001', 'master', 1, 1, 1, 2, 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 1, 1, 1),
(2, 'GUEST-001', 'guest', 1, 1, 1, NULL, 'active', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 0, 0, 1),
(3, 'EXPIRED-001', 'guest', 1, 1, 1, NULL, 'active', '2025-01-01 00:00:00', '2025-06-30 23:59:59', 0, 0, 0);

-- 执行设备
INSERT INTO `actuator_device` (`id`, `device_no`, `device_name`, `plot_id`, `device_type`, `device_status`) VALUES
(1, 'ACT-001', '灌溉设备A', 1, 'irrigator', 'idle');

-- 设备锁
INSERT INTO `device_lock` (`id`, `device_id`, `lock_status`) VALUES
(1, 1, 'free');

-- AI分析记录
INSERT INTO `ai_analysis_record` (`id`, `plot_id`, `analysis_type`, `analysis_result`, `risk_level`) VALUES
(1, 1, 'periodic', '当前土壤湿度偏低，建议灌溉', 'medium'),
(2, 1, 'manual', '作物生长正常', 'low');
