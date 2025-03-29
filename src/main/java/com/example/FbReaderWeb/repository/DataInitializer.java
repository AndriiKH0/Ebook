package com.example.FbReaderWeb.repository;

import com.example.FbReaderWeb.model.User;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer {

    @Bean
    CommandLineRunner init(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.findByUsername("admin").isEmpty()) {
                User admin = new User();
                admin.setUsername("admin");
                admin.setPassword(passwordEncoder.encode("admin"));
                admin.getRoles().add("ROLE_ADMIN");
                userRepository.save(admin);
                System.out.println("Użytkownik admin utworzony z hasłem 'admin'");
            }
        };
    }
}
