package com.example.FbReaderWeb.controller;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@Controller
public class AuthController {

    @GetMapping("/login")
    public String login() {
        return "login";
    }
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping("/register")
    public String showRegistrationForm() {
        return "register";
    }
    @PostMapping("/api/login")
    public ResponseEntity<String> loginUser(@RequestBody User user) {
        var existingUser = userRepository.findByUsername(user.getUsername());

        if (existingUser.isPresent() && passwordEncoder.matches(user.getPassword(), existingUser.get().getPassword())) {
            return ResponseEntity.ok("Login successful");
        } else {
            return ResponseEntity.status(401).body("Invalid username or password");
        }
    }
    @PostMapping("/register")
    public String registerUser(@ModelAttribute User user, @RequestParam String confirmPassword, Model model) {

        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            model.addAttribute("error", "Username already exists");
            return "register";
        }

        if (user.getUsername().length() < 5) {
            model.addAttribute("error", "Username must be at least 5 characters long");
            return "register";
        }

        if (!user.getUsername().matches("^[a-zA-Z0-9_]+$")) {
            model.addAttribute("error", "Username can only contain letters, numbers, and underscore");
            return "register";
        }

        String password = user.getPassword();
        if (password.length() < 8) {
            model.addAttribute("error", "Password must be at least 8 characters long");
            return "register";
        }

        if (!password.matches(".*[a-zA-Z].*")) {
            model.addAttribute("error", "Password must contain at least one letter");
            return "register";
        }

        if (!password.matches(".*\\d.*")) {
            model.addAttribute("error", "Password must contain at least one digit");
            return "register";
        }

        if (!password.equals(confirmPassword)) {
            model.addAttribute("error", "Passwords do not match");
            return "register";
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRoles(Set.of("ROLE_USER"));
        userRepository.save(user);
        return "redirect:/login?registered";
    }

}

