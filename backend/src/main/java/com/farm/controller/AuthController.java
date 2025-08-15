package com.farm.controller;

import com.farm.dto.AuthDtos.AuthResponse;
import com.farm.dto.AuthDtos.LoginRequest;
import com.farm.dto.AuthDtos.RegisterRequest;
import com.farm.entity.User;
import com.farm.service.JwtService;
import com.farm.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager, UserService userService, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.userService = userService;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        User user = new User();
        user.setUsername(req.username);
        user.setEmail(req.email);
        user.setPassword(req.password);
        if (req.role != null) user.setRole(req.role);
        userService.register(user);
        return ResponseEntity.ok().body(java.util.Map.of("message", "User registered"));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(req.username, req.password));
        String token = jwtService.generateToken(req.username);
        User user = new User();
        user.setUsername(req.username);
        // In a real app fetch user from DB
        AuthResponse resp = new AuthResponse();
        resp.token = token;
        resp.username = req.username;
        resp.email = req.username + "@example.com";
        resp.role = com.farm.entity.User.UserRole.FARMER;
        return ResponseEntity.ok(resp);
    }
}


