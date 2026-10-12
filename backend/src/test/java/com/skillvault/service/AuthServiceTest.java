package com.skillvault.service;

import com.skillvault.dto.*;
import com.skillvault.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.BadCredentialsException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
public class AuthServiceTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtService jwtService;

    @Test
    @DisplayName("Should successfully register, login, refresh token, and logout a user")
    void testAuthLifecycle() {
        String randomSuffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "test_" + randomSuffix + "@skillvault.dev";
        String username = "user_" + randomSuffix;
        String password = "StrongPassword123!";

        // 1. Register
        RegisterRequest registerReq = new RegisterRequest(username, email, password, "Test Engineer");
        AuthResponse registerResponse = authService.register(registerReq);

        assertThat(registerResponse.accessToken()).isNotBlank();
        assertThat(registerResponse.refreshToken()).isNotBlank();
        assertThat(registerResponse.user().email()).isEqualTo(email);
        assertThat(registerResponse.user().username()).isEqualTo(username);
        assertThat(registerResponse.user().role()).isEqualTo("ROLE_USER");

        // Validate JWT access token claims
        assertThat(jwtService.isTokenValid(registerResponse.accessToken())).isTrue();
        assertThat(jwtService.extractSubject(registerResponse.accessToken())).isEqualTo(email);

        // 2. Duplicate registration should fail
        assertThatThrownBy(() -> authService.register(registerReq))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email is already registered");

        // 3. Login with email
        LoginRequest loginEmailReq = new LoginRequest(email, password);
        AuthResponse loginEmailResponse = authService.login(loginEmailReq);
        assertThat(loginEmailResponse.accessToken()).isNotBlank();
        assertThat(loginEmailResponse.user().email()).isEqualTo(email);

        // 4. Login with username
        LoginRequest loginUsernameReq = new LoginRequest(username, password);
        AuthResponse loginUsernameResponse = authService.login(loginUsernameReq);
        assertThat(loginUsernameResponse.accessToken()).isNotBlank();
        assertThat(loginUsernameResponse.user().username()).isEqualTo(username);

        // 5. Login with invalid password fails
        LoginRequest badPasswordReq = new LoginRequest(email, "WrongPassword!");
        assertThatThrownBy(() -> authService.login(badPasswordReq))
                .isInstanceOf(BadCredentialsException.class);

        // 6. Refresh token rotation
        RefreshTokenRequest refreshReq = new RefreshTokenRequest(loginEmailResponse.refreshToken());
        AuthResponse refreshResponse = authService.refreshToken(refreshReq);

        assertThat(refreshResponse.accessToken()).isNotBlank();
        assertThat(refreshResponse.refreshToken()).isNotBlank();
        // The new refresh token should be rotated
        assertThat(refreshResponse.refreshToken()).isNotEqualTo(loginEmailResponse.refreshToken());

        // Old refresh token must be revoked / invalid now
        assertThatThrownBy(() -> authService.refreshToken(refreshReq))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("revoked");

        // 7. Get Current User
        UserDto me = authService.getCurrentUser(email);
        assertThat(me.email()).isEqualTo(email);
        assertThat(me.username()).isEqualTo(username);

        // 8. Logout revokes active refresh token
        authService.logout(refreshResponse.refreshToken());
        RefreshTokenRequest loggedOutRefreshReq = new RefreshTokenRequest(refreshResponse.refreshToken());
        assertThatThrownBy(() -> authService.refreshToken(loggedOutRefreshReq))
                .isInstanceOf(SecurityException.class);
    }
}
