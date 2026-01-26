#include "Menu.h"
#include <iostream>
#include <fstream>
#include <limits>
#include <iomanip>

using namespace std;

/* ---------- Menu FUNCTIONS ---------- */

void loadMenu(vector<MenuItem>& Menu) {
    ifstream file("Menu.txt");
    if (!file) return;

    string name;
    float price;

    while (getline(file, name, ',')) {
        file >> price;
        file.ignore(numeric_limits<streamsize>::max(), '\n');
        Menu.push_back({name, price});
    }
}

void saveMenu(const vector<MenuItem>& Menu) {
    ofstream file("Menu.txt");

    for (const auto& item : Menu) {
        file << item.name << "," << item.price << '\n';
    }
}

void showMenu(const vector<MenuItem>& Menu) {
    cout << "\n------ MENU ------\n";

    for (size_t i = 0; i < Menu.size(); i++) {
        cout << i + 1 << ". "
             << Menu[i].name
             << " - $"
             << fixed << setprecision(2)
             << Menu[i].price << endl;
    }
}

void addMenuItem(vector<MenuItem>& Menu) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    MenuItem item;

    cout << "Enter item name: ";
    getline(cin, item.name);

    cout << "Enter price: ";
    while (!(cin >> item.price) || item.price <= 0) {
        cout << "Invalid price. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    Menu.push_back(item);
    saveMenu(Menu);

    cout << "Item added to Menu.\n";
}

void editMenuItemPrice(std::vector<MenuItem>& menu) {
    if (menu.empty()) {
        cout << "Menu is empty.\n";
        return;
    }

    showMenu(menu);

    int choice;
    cout << "Select item number to edit price: ";
    if (!(cin >> choice) || choice < 1 || choice > menu.size()) {
        cout << "Invalid selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    float newPrice;
    cout << "Enter new price: ";
    while (!(cin >> newPrice) || newPrice <= 0) {
        cout << "Invalid price. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    menu[choice - 1].price = newPrice;
    saveMenu(menu);

    cout << "Price updated successfully.\n";
}