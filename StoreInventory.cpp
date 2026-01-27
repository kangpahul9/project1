#include "StoreInventory.h"
#include "Expenses.h"

#include <iostream>
#include <fstream>
#include <limits>
#include <iomanip>

using namespace std;

/* ---------- STORE INVENTORY FUNCTIONS ---------- */

void loadStoreInventory(vector<StoreItem>& store) {
    ifstream file("store_inventory.txt");
    if (!file) return;

    StoreItem item;

    while (getline(file, item.name, ',')) {
        getline(file, item.unit, ',');
        file >> item.quantity;
        file.ignore(1); // skip comma
        file >> item.costPerUnit;
        file.ignore(numeric_limits<streamsize>::max(), '\n');

        store.push_back(item);
    }
}

void saveStoreInventory(const vector<StoreItem>& store) {
    ofstream file("store_inventory.txt");

    for (const auto& item : store) {
        file << item.name << ","
             << item.unit << ","
             << item.quantity << ","
             << item.costPerUnit << "\n";
    }
}

void showStoreInventory(const vector<StoreItem>& store) {
    if (store.empty()) {
        cout << "Store inventory is empty.\n";
        return;
    }

    cout << "\n====== STORE ROOM INVENTORY ======\n";
    cout << left << setw(15) << "Item"
         << setw(8) << "Qty"
         << setw(6) << "Unit"
         << "Cost/Unit\n";

    cout << "----------------------------------\n";

    for (const auto& item : store) {
        cout << left << setw(15) << item.name
             << setw(8) << item.quantity
             << setw(6) << item.unit
             << fixed << setprecision(2)
             << item.costPerUnit << endl;
    }
}

void addStoreItem(vector<StoreItem>& store) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    StoreItem item;

    cout << "Enter item name: ";
    getline(cin, item.name);

    cout << "Enter unit (kg/L/pcs): ";
    getline(cin, item.unit);

    cout << "Enter quantity: ";
    while (!(cin >> item.quantity) || item.quantity <= 0) {
        cout << "Invalid quantity. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    cout << "Enter cost per unit: ";
    while (!(cin >> item.costPerUnit) || item.costPerUnit <= 0) {
        cout << "Invalid cost. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    store.push_back(item);
    saveStoreInventory(store);

    cout << "Store item added successfully.\n";
}

void updateStoreItemQuantity(vector<StoreItem>& store) {
    if (store.empty()) {
        cout << "Store inventory is empty.\n";
        return;
    }

    showStoreInventory(store);

    int choice;
    cout << "Select item number: ";
    if (!(cin >> choice) || choice < 1 || choice > store.size()) {
        cout << "Invalid selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    cout << "1. Add quantity (Purchase)\n";
    cout << "2. Reduce quantity (Usage)\n";
    cout << "Choice: ";

    int action;
    cin >> action;

    float qty;
    cout << "Enter quantity: ";
    while (!(cin >> qty) || qty <= 0) {
        cout << "Invalid quantity. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    if (action == 1) {
        store[choice - 1].quantity += qty;
    } 
    else if (action == 2) {
        if (store[choice - 1].quantity < qty) {
            cout << "Not enough stock.\n";
            return;
        }
        store[choice - 1].quantity -= qty;
    } 
    else {
        cout << "Invalid action.\n";
        return;
    }

    saveStoreInventory(store);
    cout << "Store inventory updated.\n";
}


void useStoreItem(vector<StoreItem>& store) {
    if (store.empty()) {
        cout << "Store inventory is empty.\n";
        return;
    }

    showStoreInventory(store);

    int choice;
    cout << "Select item to use: ";
    if (!(cin >> choice) || choice < 1 || choice > store.size()) {
        cout << "Invalid selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    float qty;
    cout << "Enter quantity used: ";
    while (!(cin >> qty) || qty <= 0) {
        cout << "Invalid quantity. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    StoreItem& item = store[choice - 1];

    if (item.quantity < qty) {
        cout << "Not enough stock.\n";
        return;
    }

    item.quantity -= qty;
    saveStoreInventory(store);

    // ---- Create expense ----
    float cost = qty * item.costPerUnit;

    vector<Expense> expenses;
    loadExpenses(expenses);

    Expense e;
    e.id = generateId("EXP");
    e.description = "Store usage: " + item.name;
    e.amount = cost;
    e.isPaid = false;

    expenses.push_back(e);
    saveExpenses(expenses);

    cout << "Stock updated and expense recorded.\n";
}