package com.longarch.module.adoption.service;

import com.longarch.module.adoption.dto.CreateShareCodeReq;
import com.longarch.module.adoption.dto.RedeemCodeReq;
import com.longarch.module.adoption.dto.VerifyCodeReq;
import com.longarch.module.adoption.vo.RedeemCodeVO;
import com.longarch.module.adoption.vo.ShareCodeVO;
import com.longarch.module.adoption.vo.VerifyCodeVO;

import java.util.List;

public interface AdoptionCodeService {

    VerifyCodeVO verify(VerifyCodeReq req);

    RedeemCodeVO redeem(RedeemCodeReq req);

    ShareCodeVO createShareCode(CreateShareCodeReq req);

    List<ShareCodeVO> getMyShares(Long plotId);

    void revokeShareCode(Long codeId);
}
