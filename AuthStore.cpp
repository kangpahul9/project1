#include "AuthStore.h"
#include "Utils.h"
#include <fstream>
#include <sstream>

using namespace std;

string roleToString(UserRole role) {
    switch (role) {
        case UserRole::OWNER: return "OWNER";
        case UserRole::ADMIN: return "ADMIN";
        case UserRole::STAFF: return "STAFF";
    }
    return "STAFF";
}

UserRole stringToRole(const string& role) {
    if (role == "OWNER") return UserRole::OWNER;
    if (role == "ADMIN") return UserRole::ADMIN;
    return UserRole::STAFF;
}

void loadUsers(vector<User>& users) {
    ifstream file("users.txt");
    if (!file) return;

    string line;
    while (getline(file, line)) {
        stringstream ss(line);
        User u;
        string roleStr;

        getline(ss, u.id, ',');
        getline(ss, u.name, ',');
        getline(ss, u.pinHash, ',');
        getline(ss, roleStr);

        u.role = stringToRole(roleStr);
        users.push_back(u);
    }
}

void saveUsers(const vector<User>& users) {
    ofstream file("users.txt");

    for (const auto& u : users) {
        file << u.id << ","
             << u.name << ","
             << u.pinHash << ","
             << roleToString(u.role)
             << "\n";
    }
}
