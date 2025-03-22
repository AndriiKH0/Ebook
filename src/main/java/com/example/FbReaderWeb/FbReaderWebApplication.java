package com.example.FbReaderWeb;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;


@SpringBootApplication(scanBasePackages = "com.example.FbReaderWeb")
@EnableAsync
public class FbReaderWebApplication {

	public static void main(String[] args) {
		SpringApplication.run(FbReaderWebApplication.class, args);
	}
}
