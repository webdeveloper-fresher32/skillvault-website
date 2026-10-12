package com.skillvault.dto;

import com.skillvault.model.User;

public record UserDto(
    Long id,
    String username,
    String email,
    String fullName,
    String role
) {
    public static UserDto fromEntity(User user) {
        return new UserDto(
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getFullName(),
            user.getRole()
        );
    }
}
