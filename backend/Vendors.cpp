#include "Vendors.h"

#include <iostream>
#include <fstream>
#include <limits>

using namespace std;

/* ---------- VENDOR FUNCTIONS ---------- */

void loadVendors(vector<Vendor>& vendors) {
    ifstream file("vendors.txt");
    if (!file) return;

    Vendor v;
    while (getline(file, v.name)) {
        vendors.push_back(v);
    }
}

void saveVendors(const vector<Vendor>& vendors) {
    ofstream file("vendors.txt");
    for (const auto& v : vendors) {
        file << v.name << "\n";
    }
}

void showVendors(const vector<Vendor>& vendors) {
    if (vendors.empty()) {
        cout << "No vendors found.\n";
        return;
    }

    cout << "\n====== VENDORS ======\n";
    for (size_t i = 0; i < vendors.size(); i++) {
        cout << i + 1 << ". " << vendors[i].name << endl;
    }
}

void addVendor(vector<Vendor>& vendors) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    Vendor v;
    cout << "Enter vendor name: ";
    getline(cin, v.name);

    vendors.push_back(v);
    saveVendors(vendors);

    cout << "Vendor added successfully.\n";
}
