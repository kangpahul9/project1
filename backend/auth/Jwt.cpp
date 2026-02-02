#include "Jwt.h"

#include <jwt-cpp/jwt.h>
#include <chrono>

// 🔐 CHANGE THIS IN PROD
static const std::string JWT_SECRET = "SUPER_SECRET_KEY_CHANGE_ME";

// Token valid for 24 hours
static constexpr int TOKEN_EXP_HOURS = 24;

std::string generateJwt(
    const std::string& userId,
    const std::string& role
) {
    using namespace std::chrono;

    auto token = jwt::create()
        .set_type("JWT")
        .set_issuer("restaurant-pos")
        .set_subject(userId)
        .set_payload_claim("role", jwt::claim(role))
        .set_issued_at(system_clock::now())
        .set_expires_at(system_clock::now() + hours(TOKEN_EXP_HOURS))
        .sign(jwt::algorithm::hs256{JWT_SECRET});

    return token;
}

JwtPayload verifyJwt(const std::string& token) {
    JwtPayload result;

    try {
        auto decoded = jwt::decode(token);

        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{JWT_SECRET})
            .with_issuer("restaurant-pos");

        verifier.verify(decoded);

        result.valid = true;
        result.userId = decoded.get_subject();
        result.role = decoded.get_payload_claim("role").as_string();
    }
    catch (...) {
        result.valid = false;
    }

    return result;
}
