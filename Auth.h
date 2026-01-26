#ifndef AUTH_H
#define AUTH_H

enum class Role {
    ADMIN,
    STAFF
};

Role selectRole();
bool isAdmin(Role role);

#endif
