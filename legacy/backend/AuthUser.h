#ifndef AUTH_USER_H
#define AUTH_USER_H

#include <string>

enum class UserRole {
    OWNER,
    ADMIN,
    STAFF
};

struct User {
    std::string id;
    std::string name;
    std::string pinHash;
    UserRole role;
};

std::string roleToString(UserRole role);
UserRole stringToRole(const std::string& role);

#endif
