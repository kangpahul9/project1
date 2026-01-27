#include "Order.h"

#include <iostream>
#include <iomanip>
#include <fstream>
#include <limits>

using namespace std;

/* ---------- ORDER ITEM ---------- */

float OrderItem::total() const {
    return price * quantity;
}

/* ---------- ORDER FUNCTIONS ---------- */

void addItemToOrder(vector<OrderItem>& order, const vector<MenuItem>& Menu) {
    if (Menu.empty()) {
        cout << "Menu is empty.\n";
        return;
    }

    showMenu(Menu);

    int choice, qty;

    cout << "Select item number: ";
    if (!(cin >> choice) || choice < 1 || choice > Menu.size()) {
        cout << "Invalid item selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    cout << "Enter quantity: ";
    if (!(cin >> qty) || qty <= 0) {
        cout << "Invalid quantity.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    const MenuItem& inv = Menu[choice - 1];

    // Merge duplicate items
    for (auto& item : order) {
        if (item.name == inv.name) {
            item.quantity += qty;
            cout << "Updated quantity for " << inv.name << ".\n";
            return;
        }
    }

    order.push_back({
    generateId("ORD"),
    inv.name,
    inv.price,
    qty,
    PaymentMode::CASH   // temp default
});
    cout << "Item added to order.\n";
}

void viewOrder(const vector<OrderItem>& order) {
    if (order.empty()) {
        cout << "Order is empty.\n";
        return;
    }

    float total = 0;

    cout << "\nItem | Price | Qty | Total\n";
    cout << "---------------------------\n";

    for (const auto& item : order) {
        cout << left << setw(15) << item.name << " | "
             << fixed << setprecision(2) << item.price << " | "
             << item.quantity << " | "
             << fixed << setprecision(2) << item.total() << endl;

        total += item.total();
    }

    cout << "\nCurrent Total: $" << fixed << setprecision(2) << total << endl;
}

void printFinalBill(const vector<OrderItem>& order) {
    float total = 0;

    cout << "\n====== FINAL BILL ======\n";
    for (const auto& item : order) {
        cout << item.name << " x" << item.quantity
             << " = $" << fixed << setprecision(2)
             << item.total() << endl;
        total += item.total();
    }

    cout << "\nGrand Total: $" << fixed << setprecision(2) << total << endl;
}

void logOrder(const vector<OrderItem>& order) {
    ofstream file("orders.txt", ios::app);
    float total = 0;

    for (const auto& item : order) {
        file << item.name << ","
             << item.quantity << ","
             << item.price << "\n";
        total += item.total();
    }

    // payment mode stored ONCE
    file << "TOTAL," << fixed << setprecision(2) << total
         << "," << paymentModeToString(order[0].paymentMode) << "\n";
    file << "---\n";
}