package com.longarch.module.sensor.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.longarch.module.sensor.entity.SensorData;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

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
}
