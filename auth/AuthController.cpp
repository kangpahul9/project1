#include "AuthController.h"
#include "../AuthService.h"
#include "../AuthStore.h"   // ✅ REQUIRED
#include <vector>

LoginResult loginController(const std::string& pin) {
    std::vector<User> users;
    loadUsers(users);
    return authenticate(users, pin);
}
