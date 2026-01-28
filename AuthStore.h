#ifndef AUTH_STORE_H
#define AUTH_STORE_H

#include <vector>
#include "AuthUser.h"

void loadUsers(std::vector<User>& users);
void saveUsers(const std::vector<User>& users);

#endif
