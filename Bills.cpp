#include "Bills.h"
#include "Expenses.h"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <limits>

using namespace std;

/* ---------- BILL FUNCTIONS ---------- */

void loadBills(vector<Bill>& bills) {
    ifstream file("bills.txt");
    if (!file) return;

    Bill b;
    int paidFlag;

    while (getline(file, b.vendor, ',')) {
        getline(file, b.filePath, ',');
        file >> b.amount >> paidFlag;
        b.isPaid = (paidFlag == 1);
        file.ignore(numeric_limits<streamsize>::max(), '\n');
        bills.push_back(b);
    }
}

void saveBills(const vector<Bill>& bills) {
    ofstream file("bills.txt");

    for (const auto& b : bills) {
        file << b.vendor << ","
             << b.filePath << ","
             << b.amount << " "
             << (b.isPaid ? 1 : 0) << "\n";
    }
}

void showBills(const vector<Bill>& bills) {
    if (bills.empty()) {
        cout << "No bills recorded.\n";
        return;
    }

    cout << "\n====== BILLS ======\n";
    cout << left << setw(15) << "Vendor"
         << setw(12) << "Amount"
         << setw(10) << "Status"
         << "File\n";

    cout << "---------------------------------------------\n";

    for (const auto& b : bills) {
        cout << left << setw(15) << b.vendor
             << setw(12) << fixed << setprecision(2) << b.amount
             << setw(10) << (b.isPaid ? "PAID" : "UNPAID")
             << b.filePath << endl;
    }
}

void addBill(vector<Bill>& bills) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    Bill b;

    cout << "Enter vendor name: ";
    getline(cin, b.vendor);

    cout << "Enter bill file path (or leave blank): ";
    getline(cin, b.filePath);

    cout << "Enter bill amount: ";
    while (!(cin >> b.amount) || b.amount <= 0) {
        cout << "Invalid amount. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    b.isPaid = false;
    bills.push_back(b);
    saveBills(bills);

    // ---- Auto-create Expense ----
    vector<Expense> expenses;
    loadExpenses(expenses);

    Expense e;
    e.description = "Bill: " + b.vendor;
    e.amount = b.amount;
    e.isPaid = false;

    expenses.push_back(e);
    saveExpenses(expenses);

    cout << "Bill added and expense auto-created.\n";
}

void markBillPaid(vector<Bill>& bills) {
    if (bills.empty()) {
        cout << "No bills available.\n";
        return;
    }

    showBills(bills);

    int choice;
    cout << "Select bill number to mark as PAID: ";
    if (!(cin >> choice) || choice < 1 || choice > bills.size()) {
        cout << "Invalid selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    Bill& b = bills[choice - 1];

    if (b.isPaid) {
        cout << "Bill is already marked as PAID.\n";
        return;
    }

    b.isPaid = true;
    saveBills(bills);

    // ---- Sync with Expense ----
    vector<Expense> expenses;
    loadExpenses(expenses);

    string targetDesc = "Bill: " + b.vendor;
    bool found = false;

    for (auto& e : expenses) {
        if (e.description == targetDesc) {
            e.isPaid = true;
            found = true;
            break;
        }
    }

    if (found) {
        saveExpenses(expenses);
        cout << "Bill and corresponding expense marked as PAID.\n";
    } else {
        cout << "Warning: Corresponding expense not found.\n";
    }
}
