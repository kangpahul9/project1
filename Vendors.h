#ifndef VENDORS_H
#define VENDORS_H

#include <string>
#include <vector>

struct Vendor {
    std::string name;
};

void loadVendors(std::vector<Vendor>& vendors);
void saveVendors(const std::vector<Vendor>& vendors);
void showVendors(const std::vector<Vendor>& vendors);
void addVendor(std::vector<Vendor>& vendors);

#endif