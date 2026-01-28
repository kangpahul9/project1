#ifndef JWT_H
#define JWT_H

#include <string>

struct JwtPayload {
    bool valid = false;
    std::string userId;
    std::string role;
};

// Generate JWT token
std::string generateJwt(
    const std::string& userId,
    const std::string& role
);

// Verify JWT token
JwtPayload verifyJwt(const std::string& token);

#endif
