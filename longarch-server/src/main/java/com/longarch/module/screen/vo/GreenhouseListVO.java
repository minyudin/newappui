package com.longarch.module.screen.vo;

import lombok.Data;

import java.util.List;

/**
 * 同农场下的大棚列表 — 供大屏切换器使用
 */
@Data
public class GreenhouseListVO {

    private String farmName;
    private List<GreenhouseItem> greenhouses;

    @Data
    public static class GreenhouseItem {
        private Long id;
        private String name;
        /** 子点位数量 */
        private int plotCount;
    }
}
