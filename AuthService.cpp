#include "AuthService.h"

LoginResult authenticate(
    const std::vector<User>& users,
    const std::string& pin
) {
    for (const auto& u : users) {
        if (u.pinHash == pin) {   // hashing comes later
            return {
                true,
                "Login successful",
                "",               // token (Phase 9.2.3)
                roleToString(u.role),
                u.id,
                u
            };
        }
    }

    return {
        false,
        "Invalid PIN",
        "",
        "",
        "",
        {}
    };
}
