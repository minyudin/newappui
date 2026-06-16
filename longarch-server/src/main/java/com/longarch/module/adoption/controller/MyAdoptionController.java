package com.longarch.module.adoption.controller;

import com.longarch.common.result.PageResult;
import com.longarch.common.result.R;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.adoption.vo.AdoptionDetailVO;
import com.longarch.module.adoption.vo.AdoptionListVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "我的认养")
@RestController
@RequestMapping("/api/v1/my")
@RequiredArgsConstructor
public class MyAdoptionController {

    private final AccessScopeService accessScopeService;

    @Operation(summary = "API-07 我的认养列表")
    @GetMapping("/adoptions")
    public R<PageResult<AdoptionListVO>> myAdoptions(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status) {
        return R.ok(accessScopeService.getMyAdoptions(pageNo, pageSize, status));
    }

    @Operation(summary = "API-08 认养详情")
    @GetMapping("/adoptions/{orderId}")
    public R<AdoptionDetailVO> adoptionDetail(@PathVariable Long orderId) {
        return R.ok(accessScopeService.getAdoptionDetail(orderId));
    }
}
