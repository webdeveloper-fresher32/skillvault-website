package com.skillvault.dto;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresInSeconds,
    UserDto user
) {
    public static AuthResponse of(String accessToken, String refreshToken, long expiresInSeconds, UserDto user) {
        return new AuthResponse(accessToken, refreshToken, "Bearer", expiresInSeconds, user);
    }
}
