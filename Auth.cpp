#include "Auth.h"
#include <iostream>

using namespace std;

Role selectRole() {
    int choice;
    cout << "\nSelect Role:\n";
    cout << "1. Admin\n";
    cout << "2. Staff / Cashier\n";
    cout << "Choice: ";
    cin >> choice;

    if (choice == 1) return Role::ADMIN;
    return Role::STAFF;
}

bool isAdmin(Role role) {
    return role == Role::ADMIN;
}
