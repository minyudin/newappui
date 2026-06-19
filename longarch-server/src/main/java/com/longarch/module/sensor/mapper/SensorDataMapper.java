package com.longarch.module.sensor.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.longarch.module.sensor.entity.SensorData;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Mapper
public interface SensorDataMapper extends BaseMapper<SensorData> {

    /**
     * 批量取一组传感器中每个 (sensor_id, sensor_type) 的最新一条读数。
     *
     * 用单次查询替代“逐个 sensor 各发一条 LIMIT 1 / LIMIT 50”的 N+1。
     * 内层 GROUP BY 命中 idx_sensor_type_latest (sensor_id, sensor_type, sample_at)，
     * 回表 join 取该最新时间点的值。
     */
    @Select("<script>" +
            "SELECT d.id, d.sensor_id, d.plot_id, d.sensor_type, d.`value`, d.sample_at, d.created_at " +
            "FROM sensor_data d " +
            "JOIN ( " +
            "  SELECT sensor_id, sensor_type, MAX(sample_at) AS max_at " +
            "  FROM sensor_data " +
            "  WHERE sensor_id IN " +
            "  <foreach collection='sensorIds' item='sid' open='(' separator=',' close=')'>#{sid}</foreach> " +
            "  GROUP BY sensor_id, sensor_type " +
            ") m ON d.sensor_id = m.sensor_id AND d.sensor_type = m.sensor_type AND d.sample_at = m.max_at " +
            "</script>")
    List<SensorData> selectLatestPerType(@Param("sensorIds") Collection<Long> sensorIds);

    /**
     * 分批删除早于 cutoff 的历史读数（P-05 数据保留）。
     *
     * 按主键顺序扫描，最早的数据 id 最小、物理上靠前，扫描立即命中；
     * 每批只删 batchSize 行，配合调用方的逐批循环 + 短事务，
     * 避免一条巨型 DELETE 长时间锁表 / 撑大 undo log / 耗尽连接。
     */
    @Delete("DELETE FROM sensor_data WHERE sample_at < #{cutoff} ORDER BY id LIMIT #{batchSize}")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff, @Param("batchSize") int batchSize);
}
