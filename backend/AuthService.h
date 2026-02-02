#ifndef AUTH_SERVICE_H
#define AUTH_SERVICE_H

#include <string>
#include <vector>
#include "AuthUser.h"

struct LoginResult {
    bool success;
    std::string message;

    // JWT layer (Phase 9.2)
    std::string token;
    std::string role;
    std::string userId;

    User user; // keep full user for internal use
};

LoginResult authenticate(
    const std::vector<User>& users,
    const std::string& pin
);

#endif
