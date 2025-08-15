package com.farm.dto;

import com.farm.entity.User.UserRole;

public class AuthDtos {
    public static class LoginRequest {
        public String username;
        public String password;
    }

    public static class RegisterRequest {
        public String username;
        public String email;
        public String password;
        public UserRole role;
    }

    public static class AuthResponse {
        public String token;
        public String username;
        public String email;
        public UserRole role;
    }
}


