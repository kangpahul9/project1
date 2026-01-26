#ifndef STAFF_H
#define STAFF_H

#include <string>
#include <vector>

struct Staff {
    std::string name;
    std::string role;
    float salary;
};

void loadStaff(std::vector<Staff>& staff);
void saveStaff(const std::vector<Staff>& staff);
void showStaff(const std::vector<Staff>& staff);
void addStaff(std::vector<Staff>& staff);

#endif
