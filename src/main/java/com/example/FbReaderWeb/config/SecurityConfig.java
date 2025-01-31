package com.example.FbReaderWeb.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Отключаем CSRF для упрощения разработки
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/login", "/register", "/css/**", "/js/**", "/h2-console/**").permitAll() // Разрешаем доступ к страницам без авторизации
                        .anyRequest().authenticated() // Остальные запросы требуют авторизации
                )
                .formLogin(form -> form
                        .loginPage("/login") // Кастомная страница логина
                        .defaultSuccessUrl("/library", true) // Перенаправление на библиотеку после успешного входа
                        .permitAll() // Разрешаем всем доступ к странице логина
                )
                .logout(logout -> logout
                        .logoutUrl("/logout") // URL для выхода
                        .logoutSuccessUrl("/login?logout") // Перенаправление после выхода
                        .permitAll() // Разрешаем всем доступ к выходу
                )
                .headers(headers -> headers.frameOptions(frameOptions -> frameOptions.disable())) // Отключаем frameOptions для работы H2 Console
                .httpBasic(Customizer.withDefaults()); // Включаем HTTP Basic (при необходимости)

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // Используем BCrypt для шифрования паролей
    }
}
