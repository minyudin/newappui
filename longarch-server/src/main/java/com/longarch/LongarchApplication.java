package com.longarch;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.integration.config.EnableIntegration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.longarch.module.**.mapper")
@EnableAsync
@EnableScheduling
@EnableIntegration
public class LongarchApplication {

    public static void main(String[] args) {
        SpringApplication.run(LongarchApplication.class, args);
    }
}
