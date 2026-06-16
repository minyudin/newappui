package com.longarch.common.result;

import com.longarch.common.enums.ErrorCode;
import com.longarch.common.util.RequestIdUtil;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Data
public class R<T> {

    private int code;
    private String message;
    private T data;
    private String requestId;
    private String serverTime;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.setCode(ErrorCode.SUCCESS.getCode());
        r.setMessage(ErrorCode.SUCCESS.getMessage());
        r.setData(data);
        r.setRequestId(RequestIdUtil.get());
        r.setServerTime(LocalDateTime.now().format(FMT));
        return r;
    }

    public static <T> R<T> ok() {
        return ok(null);
    }

    public static <T> R<T> fail(ErrorCode errorCode) {
        R<T> r = new R<>();
        r.setCode(errorCode.getCode());
        r.setMessage(errorCode.getMessage());
        r.setRequestId(RequestIdUtil.get());
        r.setServerTime(LocalDateTime.now().format(FMT));
        return r;
    }

    public static <T> R<T> fail(ErrorCode errorCode, String message) {
        R<T> r = new R<>();
        r.setCode(errorCode.getCode());
        r.setMessage(message);
        r.setRequestId(RequestIdUtil.get());
        r.setServerTime(LocalDateTime.now().format(FMT));
        return r;
    }

    public static <T> R<T> fail(int code, String message) {
        R<T> r = new R<>();
        r.setCode(code);
        r.setMessage(message);
        r.setRequestId(RequestIdUtil.get());
        r.setServerTime(LocalDateTime.now().format(FMT));
        return r;
    }
}
