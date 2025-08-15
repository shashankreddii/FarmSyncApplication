package com.farm.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.Key;
import java.util.Date;

@Service
public class JwtService {
    private static final String SECRET = "YXZlcnktbG9uZy1zZWNyZXQta2V5LWZvci1mYXJtLWFwcA=="; // demo only
    private final UserService userService;

    public JwtService(UserService userService) { this.userService = userService; }

    private Key getSigningKey() { return Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRET)); }

    public String generateToken(String username) {
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractUsername(String token) {
        Claims claims = Jwts.parserBuilder().setSigningKey(getSigningKey()).build().parseClaimsJws(token).getBody();
        return claims.getSubject();
    }

    public OncePerRequestFilter jwtAuthFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
                String auth = request.getHeader("Authorization");
                if (auth != null && auth.startsWith("Bearer ")) {
                    String token = auth.substring(7);
                    try {
                        String username = extractUsername(token);
                        UserDetails user = userService.loadUserByUsername(username);
                        Authentication authentication = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authentication);
                    } catch (Exception ignored) { }
                }
                filterChain.doFilter(request, response);
            }
        };
    }
}


