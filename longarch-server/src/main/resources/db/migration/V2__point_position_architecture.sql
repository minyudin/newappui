-- ============================================================
-- V2: 点位制架构改造
-- 每个物理点位 = 1个 plot，大棚作为 parent 分组
-- ============================================================

-- 1. plot 表新增 parent_id 字段（自引用，大棚→点位层级）
SET @plot_parent_id_exists := (
    SELECT COUNT(1)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'plot'
      AND column_name = 'parent_id'
);
SET @ddl_plot_parent_id := IF(
    @plot_parent_id_exists = 0,
    'ALTER TABLE plot ADD COLUMN parent_id BIGINT NULL AFTER farm_name',
    'SELECT 1'
);
PREPARE stmt_plot_parent_id FROM @ddl_plot_parent_id;
EXECUTE stmt_plot_parent_id;
DEALLOCATE PREPARE stmt_plot_parent_id;

SET @idx_plot_parent_id_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'plot'
      AND index_name = 'idx_plot_parent_id'
);
SET @ddl_idx_plot_parent_id := IF(
    @idx_plot_parent_id_exists = 0,
    'ALTER TABLE plot ADD INDEX idx_plot_parent_id (parent_id)',
    'SELECT 1'
);
PREPARE stmt_idx_plot_parent_id FROM @ddl_idx_plot_parent_id;
EXECUTE stmt_idx_plot_parent_id;
DEALLOCATE PREPARE stmt_idx_plot_parent_id;

-- ============================================================
-- 2. 创建 13 个点位（子 plot），parent_id 指向所属大棚
-- ============================================================

-- 1号大棚 (parent=30003) 的 5 个点位
INSERT IGNORE INTO plot (id, plot_no, plot_name, farm_id, farm_name, parent_id, plot_status, intro_text) VALUES
(40001, 'PT-DM01-01', '1#点位', 1, '稻梦田园', 30003, 'active', '1号大棚桁架点位，部署摄像机+环境传感器'),
(40002, 'PT-DM01-02', '2#点位', 1, '稻梦田园', 30003, 'active', '1号大棚棚壁土壤监测点'),
(40003, 'PT-DM01-03', '3#点位', 1, '稻梦田园', 30003, 'active', '1号大棚棚壁土壤监测点'),
(40004, 'PT-DM01-04', '4#点位', 1, '稻梦田园', 30003, 'active', '1号大棚棚壁土壤监测点'),
(40005, 'PT-DM01-05', '5#点位', 1, '稻梦田园', 30003, 'active', '1号大棚棚壁土壤监测点');

-- 2号大棚 (parent=30004) 的 3 个点位
INSERT IGNORE INTO plot (id, plot_no, plot_name, farm_id, farm_name, parent_id, plot_status, intro_text) VALUES
(40006, 'PT-DM02-06', '6#点位', 1, '稻梦田园', 30004, 'active', '2号大棚桁架点位，部署摄像机+环境传感器'),
(40007, 'PT-DM02-07', '7#点位', 1, '稻梦田园', 30004, 'active', '2号大棚棚壁土壤监测点'),
(40008, 'PT-DM02-08', '8#点位', 1, '稻梦田园', 30004, 'active', '2号大棚棚壁土壤监测点');

-- 3号大棚 (parent=30005) 的 5 个点位
INSERT IGNORE INTO plot (id, plot_no, plot_name, farm_id, farm_name, parent_id, plot_status, intro_text) VALUES
(40009, 'PT-DM03-09', '9#点位',  1, '稻梦田园', 30005, 'active', '3号大棚桁架点位，部署摄像机+环境传感器'),
(40010, 'PT-DM03-10', '10#点位', 1, '稻梦田园', 30005, 'active', '3号大棚棚壁土壤监测点'),
(40011, 'PT-DM03-11', '11#点位', 1, '稻梦田园', 30005, 'active', '3号大棚棚壁土壤监测点'),
(40012, 'PT-DM03-12', '12#点位', 1, '稻梦田园', 30005, 'active', '3号大棚棚壁土壤监测点'),
(40013, 'PT-DM03-13', '13#点位', 1, '稻梦田园', 30005, 'active', '3号大棚棚壁土壤监测点');

-- ============================================================
-- 3. 重新分配传感器到子点位
--    先期每棚只部署1套，环境传感器→环境点位，土壤传感器→第1个土壤点位
-- ============================================================

-- 1号大棚传感器
UPDATE sensor_device SET plot_id = 40001 WHERE device_no = 'SEN-ENV-DM01';   -- 环境 → 1#点位
UPDATE sensor_device SET plot_id = 40002 WHERE device_no = 'SEN-NPK-DM01';   -- NPK  → 2#点位
UPDATE sensor_device SET plot_id = 40002 WHERE device_no = 'SEN-PH-DM01';    -- pH   → 2#点位
UPDATE sensor_device SET plot_id = 40002 WHERE device_no = 'SEN-SM-DM01';    -- 土温土湿 → 2#点位

-- 2号大棚传感器
UPDATE sensor_device SET plot_id = 40006 WHERE device_no = 'SEN-ENV-DM02';   -- 环境 → 6#点位
UPDATE sensor_device SET plot_id = 40007 WHERE device_no = 'SEN-NPK-DM02';   -- NPK  → 7#点位
UPDATE sensor_device SET plot_id = 40007 WHERE device_no = 'SEN-PH-DM02';    -- pH   → 7#点位
UPDATE sensor_device SET plot_id = 40007 WHERE device_no = 'SEN-SM-DM02';    -- 土温土湿 → 7#点位

-- 3号大棚传感器
UPDATE sensor_device SET plot_id = 40009 WHERE device_no = 'SEN-ENV-DM03';   -- 环境 → 9#点位
UPDATE sensor_device SET plot_id = 40010 WHERE device_no = 'SEN-NPK-DM03';   -- NPK  → 10#点位
UPDATE sensor_device SET plot_id = 40010 WHERE device_no = 'SEN-PH-DM03';    -- pH   → 10#点位
UPDATE sensor_device SET plot_id = 40010 WHERE device_no = 'SEN-SM-DM03';    -- 土温土湿 → 10#点位

-- ============================================================
-- 4. 重新分配摄像头到环境点位
-- ============================================================
UPDATE camera_device SET plot_id = 40001 WHERE device_no = 'CAM-DM01';  -- → 1#点位
UPDATE camera_device SET plot_id = 40006 WHERE device_no = 'CAM-DM02';  -- → 6#点位
UPDATE camera_device SET plot_id = 40009 WHERE device_no = 'CAM-DM03';  -- → 9#点位

-- ============================================================
-- 5. 同步 sensor_data.plot_id（保持数据一致性）
-- ============================================================
UPDATE sensor_data SET plot_id = 40001 WHERE sensor_id = 70010;   -- 环境传感器数据 → 1#
UPDATE sensor_data SET plot_id = 40002 WHERE sensor_id = 70020;   -- NPK数据 → 2#
UPDATE sensor_data SET plot_id = 40002 WHERE sensor_id = 70030;   -- pH数据 → 2#
UPDATE sensor_data SET plot_id = 40002 WHERE sensor_id = 70040;   -- 土温土湿数据 → 2#

UPDATE sensor_data SET plot_id = 40006 WHERE sensor_id = 70011;   -- 环境传感器数据 → 6#
UPDATE sensor_data SET plot_id = 40007 WHERE sensor_id = 70021;   -- NPK数据 → 7#
UPDATE sensor_data SET plot_id = 40007 WHERE sensor_id = 70031;   -- pH数据 → 7#
UPDATE sensor_data SET plot_id = 40007 WHERE sensor_id = 70041;   -- 土温土湿数据 → 7#

UPDATE sensor_data SET plot_id = 40009 WHERE sensor_id = 70012;   -- 环境传感器数据 → 9#
UPDATE sensor_data SET plot_id = 40010 WHERE sensor_id = 70022;   -- NPK数据 → 10#
UPDATE sensor_data SET plot_id = 40010 WHERE sensor_id = 70032;   -- pH数据 → 10#
UPDATE sensor_data SET plot_id = 40010 WHERE sensor_id = 70042;   -- 土温土湿数据 → 10#
