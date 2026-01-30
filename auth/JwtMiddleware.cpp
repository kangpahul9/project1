#include "JwtMiddleware.h"

static std::string extractBearerToken(const crow::request& req) {
    auto auth = req.get_header_value("Authorization");
    const std::string prefix = "Bearer ";
    if (auth.rfind(prefix, 0) != 0) return "";
    return auth.substr(prefix.size());
}

AuthContext authenticateRequest(const crow::request& req) {
    AuthContext ctx;

    std::string token = extractBearerToken(req);
    if (token.empty()) return ctx;

    auto payload = verifyJwt(token);
    if (!payload.valid) return ctx;

    ctx.authenticated = true;
    ctx.userId = payload.userId;
    ctx.role = payload.role;
    return ctx;
}

bool requireAuth(const crow::request& req, AuthContext& ctx, crow::response& res) {
    ctx = authenticateRequest(req);
    if (!ctx.authenticated) {
        res = crow::response(401, "Unauthorized");
        return false;
    }
    return true;
}

bool requireAdmin(const crow::request& req, AuthContext& ctx, crow::response& res) {
    if (!requireAuth(req, ctx, res)) return false;

    if (ctx.role != "ADMIN" && ctx.role != "OWNER") {
        res = crow::response(403, "Admin access required");
        return false;
    }
    return true;
}
