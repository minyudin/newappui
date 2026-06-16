package com.longarch.module.adoption.controller;

import com.longarch.common.result.R;
import com.longarch.module.adoption.dto.CreateShareCodeReq;
import com.longarch.module.adoption.dto.RedeemCodeReq;
import com.longarch.module.adoption.dto.VerifyCodeReq;
import com.longarch.module.adoption.service.AccessScopeService;
import com.longarch.module.adoption.service.AdoptionCodeService;
import com.longarch.module.adoption.vo.AccessScopeVO;
import com.longarch.module.adoption.vo.RedeemCodeVO;
import com.longarch.module.adoption.vo.ShareCodeVO;
import com.longarch.module.adoption.vo.VerifyCodeVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "认养码管理")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AdoptionCodeController {

    private final AdoptionCodeService adoptionCodeService;
    private final AccessScopeService accessScopeService;

    @Operation(summary = "API-04 认养码预校验")
    @PostMapping("/adoption-codes/verify")
    public R<VerifyCodeVO> verify(@Valid @RequestBody VerifyCodeReq req) {
        return R.ok(adoptionCodeService.verify(req));
    }

    @Operation(summary = "API-05 兑换认养码")
    @PostMapping("/adoption-codes/redeem")
    public R<RedeemCodeVO> redeem(@Valid @RequestBody RedeemCodeReq req) {
        return R.ok(adoptionCodeService.redeem(req));
    }

    @Operation(summary = "API-06 查询认养权限范围")
    @GetMapping("/access-scopes/me")
    public R<AccessScopeVO> accessScope(@RequestParam Long plotId) {
        return R.ok(accessScopeService.getAccessScope(plotId));
    }

    @Operation(summary = "API-42 生成分享码")
    @PostMapping("/adoption-codes/share")
    public R<ShareCodeVO> createShareCode(@Valid @RequestBody CreateShareCodeReq req) {
        return R.ok(adoptionCodeService.createShareCode(req));
    }

    @Operation(summary = "API-43 查询我生成的分享码列表")
    @GetMapping("/adoption-codes/my-shares")
    public R<List<ShareCodeVO>> getMyShares(@RequestParam(required = false) Long plotId) {
        return R.ok(adoptionCodeService.getMyShares(plotId));
    }

    @Operation(summary = "API-44 撤销分享码")
    @PostMapping("/adoption-codes/{codeId}/revoke-share")
    public R<Void> revokeShareCode(@PathVariable Long codeId) {
        adoptionCodeService.revokeShareCode(codeId);
        return R.ok(null);
    }
}
