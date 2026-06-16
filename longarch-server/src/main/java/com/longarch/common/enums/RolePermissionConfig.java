package com.longarch.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * 各角色的权限配置、菜单范围和职责说明
 */
@Getter
@AllArgsConstructor
public enum RolePermissionConfig {

    ADOPTER("adopter", "认养用户", "查看自己认养的地块数据，发起操作申请，使用AI助手",
            Map.of(
                    "canViewOwnPlot", true,
                    "canViewAllPlots", false,
                    "canCreateTask", true,
                    "canTakeoverTask", false,
                    "canManagePlot", false,
                    "canManageDevice", false,
                    "canManageAdoptionOrder", false,
                    "canManageUser", false,
                    "canViewAuditLog", false
            ),
            List.of("my_adoptions", "plot_detail", "sensors", "cameras", "ai_chat", "operation_tasks")
    ),

    GUEST("guest", "游客/分享访问者", "查看分享范围内的地块基础信息和有限数据",
            Map.of(
                    "canViewOwnPlot", true,
                    "canViewAllPlots", false,
                    "canCreateTask", false,
                    "canTakeoverTask", false,
                    "canManagePlot", false,
                    "canManageDevice", false,
                    "canManageAdoptionOrder", false,
                    "canManageUser", false,
                    "canViewAuditLog", false
            ),
            List.of("plot_detail", "sensors", "cameras")
    ),

    ADMIN("admin", "平台管理员", "管理地块、订单、认养码、设备，处理异常任务",
            Map.of(
                    "canViewOwnPlot", true,
                    "canViewAllPlots", true,
                    "canCreateTask", true,
                    "canTakeoverTask", true,
                    "canManagePlot", true,
                    "canManageDevice", true,
                    "canManageAdoptionOrder", true,
                    "canManageUser", true,
                    "canViewAuditLog", true
            ),
            List.of("dashboard", "plots", "adoption_orders", "adoption_codes", "devices", "operation_tasks", "users", "audit_log")
    ),

    OPERATOR("operator", "农场运营人员", "维护农事记录、作物批次，处理任务执行",
            Map.of(
                    "canViewOwnPlot", true,
                    "canViewAllPlots", true,
                    "canCreateTask", true,
                    "canTakeoverTask", false,
                    "canManagePlot", true,
                    "canManageDevice", true,
                    "canManageAdoptionOrder", false,
                    "canManageUser", false,
                    "canViewAuditLog", false
            ),
            List.of("dashboard", "plots", "crop_batches", "operation_tasks", "devices", "farming_records")
    ),

    AGRONOMIST("agronomist", "农技人员", "提供种植指导、风险判断、专业建议，高优先级介入",
            Map.of(
                    "canViewOwnPlot", true,
                    "canViewAllPlots", true,
                    "canCreateTask", true,
                    "canTakeoverTask", false,
                    "canManagePlot", false,
                    "canManageDevice", false,
                    "canManageAdoptionOrder", false,
                    "canManageUser", false,
                    "canViewAuditLog", false
            ),
            List.of("dashboard", "plots", "crop_batches", "sensors", "ai_analysis", "operation_tasks", "farming_records")
    );

    private final String roleType;
    private final String roleName;
    private final String roleDesc;
    private final Map<String, Boolean> permissions;
    private final List<String> menuScopes;

    public static RolePermissionConfig fromRoleType(String roleType) {
        for (RolePermissionConfig config : values()) {
            if (config.roleType.equals(roleType)) {
                return config;
            }
        }
        return ADOPTER; // 默认
    }
}
