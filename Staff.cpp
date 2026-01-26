#include "Staff.h"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <limits>

using namespace std;

/* ---------- STAFF FUNCTIONS ---------- */

void loadStaff(vector<Staff>& staff) {
    ifstream file("staff.txt");
    if (!file) return;

    Staff s;

    while (getline(file, s.name, ',')) {
        getline(file, s.role, ',');
        file >> s.salary;
        file.ignore(numeric_limits<streamsize>::max(), '\n');

        staff.push_back(s);
    }
}

void saveStaff(const vector<Staff>& staff) {
    ofstream file("staff.txt");

    for (const auto& s : staff) {
        file << s.name << ","
             << s.role << ","
             << s.salary << "\n";
    }
}

void showStaff(const vector<Staff>& staff) {
    if (staff.empty()) {
        cout << "No staff records found.\n";
        return;
    }

    cout << "\n====== STAFF LIST ======\n";
    cout << left << setw(15) << "Name"
         << setw(15) << "Role"
         << "Monthly Salary\n";

    cout << "---------------------------------\n";

    for (const auto& s : staff) {
        cout << left << setw(15) << s.name
             << setw(15) << s.role
             << fixed << setprecision(2)
             << s.salary << endl;
    }
}

void addStaff(vector<Staff>& staff) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    Staff s;

    cout << "Enter staff name: ";
    getline(cin, s.name);

    cout << "Enter role: ";
    getline(cin, s.role);

    cout << "Enter monthly salary: ";
    while (!(cin >> s.salary) || s.salary <= 0) {
        cout << "Invalid salary. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    staff.push_back(s);
    saveStaff(staff);

    cout << "Staff added successfully.\n";
}
