#ifndef JWT_MIDDLEWARE_H
#define JWT_MIDDLEWARE_H

#include "../api/crow_all.h"
#include "Jwt.h"

// Auth context injected per request
struct AuthContext {
    bool authenticated = false;
    std::string userId;
    std::string role;
};

// Parse & verify JWT from Authorization header
AuthContext authenticateRequest(const crow::request& req);

// Guards
bool requireAuth(const crow::request& req, AuthContext& ctx, crow::response& res);
bool requireAdmin(const crow::request& req, AuthContext& ctx, crow::response& res);

#endif
