package com.longarch.common.exception;

import cn.dev33.satoken.exception.NotLoginException;
import cn.dev33.satoken.exception.NotRoleException;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.result.R;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotLoginException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<?> handleNotLogin(NotLoginException e) {
        log.warn("NotLoginException: {}", e.getMessage());
        return R.fail(ErrorCode.INVALID_TOKEN, "未登录或token已过期");
    }

    @ExceptionHandler(NotRoleException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<?> handleNotRole(NotRoleException e) {
        log.warn("NotRoleException: role={}, message={}", e.getRole(), e.getMessage());
        return R.fail(ErrorCode.FORBIDDEN, "无权限访问，需要角色: " + e.getRole());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public R<?> handleNoResource(NoResourceFoundException e) {
        return R.fail(40400, "资源不存在: " + e.getResourcePath());
    }

    @ExceptionHandler(BizException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<?> handleBizException(BizException e) {
        log.warn("BizException: code={}, message={}", e.getCode(), e.getMessage());
        return R.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<?> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        log.warn("Validation error: {}", msg);
        return R.fail(ErrorCode.INVALID_PARAM, msg);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<?> handleBind(BindException e) {
        String msg = e.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        log.warn("Bind error: {}", msg);
        return R.fail(ErrorCode.INVALID_PARAM, msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.OK)
    public R<?> handleConstraint(ConstraintViolationException e) {
        log.warn("Constraint violation: {}", e.getMessage());
        return R.fail(ErrorCode.INVALID_PARAM, e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public R<?> handleException(Exception e) {
        log.error("Unexpected error", e);
        return R.fail(ErrorCode.INTERNAL_ERROR, e.getClass().getSimpleName() + ": " + e.getMessage());
    }
}
