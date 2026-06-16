package com.longarch.common.util;

import org.slf4j.MDC;

import java.util.UUID;

public class RequestIdUtil {

    private static final String REQUEST_ID_KEY = "requestId";

    public static String generate() {
        String requestId = UUID.randomUUID().toString();
        MDC.put(REQUEST_ID_KEY, requestId);
        return requestId;
    }

    public static void set(String requestId) {
        MDC.put(REQUEST_ID_KEY, requestId);
    }

    public static String get() {
        String id = MDC.get(REQUEST_ID_KEY);
        return id != null ? id : "";
    }

    public static void clear() {
        MDC.remove(REQUEST_ID_KEY);
    }
}
