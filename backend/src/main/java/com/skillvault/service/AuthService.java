package com.skillvault.service;

import com.skillvault.dto.*;
import com.skillvault.model.RefreshToken;
import com.skillvault.model.User;
import com.skillvault.repository.RefreshTokenRepository;
import com.skillvault.repository.UserRepository;
import com.skillvault.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final long refreshTokenValidityDays;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${skillvault.jwt.refresh-token-validity-days:7}") long refreshTokenValidityDays) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenValidityDays = refreshTokenValidityDays;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String trimmedEmail = req.email().trim().toLowerCase();
        String trimmedUsername = req.username().trim().toLowerCase();

        if (userRepository.existsByEmail(trimmedEmail)) {
            throw new IllegalArgumentException("Email is already registered");
        }
        if (userRepository.existsByUsername(trimmedUsername)) {
            throw new IllegalArgumentException("Username is already taken");
        }

        User user = new User(
                trimmedUsername,
                trimmedEmail,
                passwordEncoder.encode(req.password()),
                req.fullName() != null ? req.fullName().trim() : trimmedUsername
        );

        User savedUser = userRepository.save(user);

        String accessToken = jwtService.generateAccessToken(savedUser);
        RefreshToken refreshToken = createRefreshToken(savedUser);

        return AuthResponse.of(
                accessToken,
                refreshToken.getToken(),
                jwtService.getAccessTokenValiditySeconds(),
                UserDto.fromEntity(savedUser)
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        String identifier = req.emailOrUsername().trim().toLowerCase();

        User user = userRepository.findByEmailOrUsername(identifier, identifier)
                .orElseThrow(() -> new BadCredentialsException("Invalid email/username or password"));

        if (!passwordEncoder.matches(req.password(), user.getPassword())) {
            throw new BadCredentialsException("Invalid email/username or password");
        }

        String accessToken = jwtService.generateAccessToken(user);
        RefreshToken refreshToken = createRefreshToken(user);

        return AuthResponse.of(
                accessToken,
                refreshToken.getToken(),
                jwtService.getAccessTokenValiditySeconds(),
                UserDto.fromEntity(user)
        );
    }

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest req) {
        String tokenStr = req.refreshToken();

        RefreshToken refreshToken = refreshTokenRepository.findByToken(tokenStr)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (refreshToken.isRevoked()) {
            // Token reuse detection: revoke all tokens for this user
            refreshTokenRepository.revokeAllUserTokens(refreshToken.getUser());
            throw new SecurityException("Refresh token was previously revoked or compromised");
        }

        if (refreshToken.getExpiryDate().isBefore(Instant.now())) {
            refreshToken.setRevoked(true);
            refreshTokenRepository.save(refreshToken);
            throw new IllegalArgumentException("Refresh token has expired. Please log in again.");
        }

        User user = refreshToken.getUser();

        // Rotate refresh token
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        RefreshToken newRefreshToken = createRefreshToken(user);
        String newAccessToken = jwtService.generateAccessToken(user);

        return AuthResponse.of(
                newAccessToken,
                newRefreshToken.getToken(),
                jwtService.getAccessTokenValiditySeconds(),
                UserDto.fromEntity(user)
        );
    }

    @Transactional
    public void logout(String refreshTokenStr) {
        if (refreshTokenStr != null && !refreshTokenStr.isBlank()) {
            refreshTokenRepository.findByToken(refreshTokenStr)
                    .ifPresent(token -> {
                        token.setRevoked(true);
                        refreshTokenRepository.save(token);
                    });
        }
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserDto.fromEntity(user);
    }

    private RefreshToken createRefreshToken(User user) {
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        Instant expiryDate = Instant.now().plus(refreshTokenValidityDays, ChronoUnit.DAYS);
        RefreshToken refreshToken = new RefreshToken(token, user, expiryDate);
        return refreshTokenRepository.save(refreshToken);
    }
}
