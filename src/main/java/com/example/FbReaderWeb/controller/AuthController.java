package com.example.FbReaderWeb.controller;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Set;

@Controller
public class AuthController {

    @GetMapping("/login")
    public String login() {
        return "login"; // Возвращает шаблон login.html
    }
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping("/register")
    public String showRegistrationForm() {
        return "register";
    }

    @PostMapping("/register")
    public String registerUser(@ModelAttribute User user) {
        // Проверяем, есть ли уже такой пользователь
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            return "redirect:/register?error=exists"; // Если пользователь существует, редирект с ошибкой
        }
        // Кодируем пароль перед сохранением
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRoles(Set.of("ROLE_USER")); // Назначаем роли
        userRepository.save(user); // Сохраняем пользователя
        return "redirect:/login"; // Перенаправляем на логин
    }

}

