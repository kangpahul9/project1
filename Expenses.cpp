#include "Expenses.h"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <limits>

using namespace std;

/* ---------- EXPENSE FUNCTIONS ---------- */

void loadExpenses(vector<Expense>& expenses) {
    ifstream file("expenses.txt");
    if (!file) return;

    Expense e;
    int paidFlag;

    while (getline(file, e.description, ',')) {
        file >> e.amount >> paidFlag;
        e.isPaid = (paidFlag == 1);
        file.ignore(numeric_limits<streamsize>::max(), '\n');
        expenses.push_back(e);
    }
}

void saveExpenses(const vector<Expense>& expenses) {
    ofstream file("expenses.txt");

    for (const auto& e : expenses) {
        file << e.description << ","
             << e.amount << " "
             << (e.isPaid ? 1 : 0) << "\n";
    }
}

void showExpenses(const vector<Expense>& expenses) {
    if (expenses.empty()) {
        cout << "No expenses recorded.\n";
        return;
    }

    float total = 0;

    cout << "\n====== EXPENSES ======\n";
    cout << left << setw(20) << "Description"
         << setw(10) << "Amount"
         << "Status\n";
    cout << "-----------------------------------\n";

    for (const auto& e : expenses) {
        cout << left << setw(20) << e.description
             << setw(10) << fixed << setprecision(2) << e.amount
             << (e.isPaid ? "PAID" : "UNPAID") << endl;
        total += e.amount;
    }

    cout << "\nTotal Expenses: "
         << fixed << setprecision(2) << total << endl;
}


void addExpense(vector<Expense>& expenses) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    Expense e;

    cout << "Enter expense description: ";
    getline(cin, e.description);

    cout << "Enter amount: ";
    while (!(cin >> e.amount) || e.amount <= 0) {
        cout << "Invalid amount. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }
    e.isPaid = false; // New expenses are unpaid by default
    expenses.push_back(e);
    saveExpenses(expenses);

    cout << "Expense added successfully.\n";
}

void markExpensePaid(vector<Expense>& expenses) {
    if (expenses.empty()) {
        cout << "No expenses available.\n";
        return;
    }

    showExpenses(expenses);

    int choice;
    cout << "Select expense number to mark as paid: ";
    if (!(cin >> choice) || choice < 1 || choice > expenses.size()) {
        cout << "Invalid selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    expenses[choice - 1].isPaid = true;
    saveExpenses(expenses);

    cout << "Expense marked as PAID.\n";
}