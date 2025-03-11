package com.example.FbReaderWeb.controller;

import java.util.Set;
import java.util.HashSet;

import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.ui.Model;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/test/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/create")
    public User createUser(@RequestParam String username, @RequestParam String password, @RequestParam String role) {
        Set<String> roles = new HashSet<>();
        roles.add(role);


        String encryptedPassword = passwordEncoder.encode(password);

        User user = new User(username, encryptedPassword, roles);
        return userRepository.save(user);
    }

    @Autowired
    private PasswordEncoder passwordEncoder;


    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/profile/{username}")
    public String getUserProfile(@PathVariable String username, Model model) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Пользователь не найден: " + username));
        model.addAttribute("user", user);
        return "profile";
    }

}
