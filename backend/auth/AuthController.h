#ifndef AUTH_CONTROLLER_H
#define AUTH_CONTROLLER_H

#include <string>
#include "../AuthService.h"
#include "../AuthUser.h"
#include "../AuthStore.h"

LoginResult loginController(const std::string& pin);

#endif
