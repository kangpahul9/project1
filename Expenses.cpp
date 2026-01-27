#include "Expenses.h"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <limits>

using namespace std;

/* ---------- EXPENSE FUNCTIONS ---------- */

void loadExpenses(vector<Expense>& expenses) {
    ifstream file("expenses.txt");
    if (!file) return;

    string line;

    while (getline(file, line)) {
    stringstream ss(line);
    Expense e;
    int paidFlag;

    // Try to read ID first
    string firstField;
    getline(ss, firstField, ',');

    // If next char is digit → legacy file (no ID)
    if (isdigit(firstField[0])) {
        // Legacy line
        e.id = generateId("EXP");
        e.description = firstField;
    } else {
        // New format
        e.id = firstField;
        getline(ss, e.description, ',');
    }

    ss >> e.amount >> paidFlag;
    e.isPaid = (paidFlag == 1);

    string modeStr;
    if (ss >> modeStr) {
        e.paymentMode =
            (modeStr == "CASH") ? PaymentMode::CASH : PaymentMode::UPI;
    } else {
        e.paymentMode = PaymentMode::CASH;
    }

    expenses.push_back(e);
}
}


void saveExpenses(const vector<Expense>& expenses) {
    ofstream file("expenses.txt");

    for (const auto& e : expenses) {
        file << e.id << ","
     << e.description << ","
     << e.amount << " "
     << (e.isPaid ? 1 : 0);

        if (e.isPaid) {
            file << " " << paymentModeToString(e.paymentMode);
        }

        file << "\n";
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
    e.id = generateId("EXP");
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
    cout << "Select expense number to mark as PAID: ";
    if (!(cin >> choice) || choice < 1 || choice > expenses.size()) {
        cout << "Invalid selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    Expense& e = expenses[choice - 1];

    if (e.isPaid) {
        cout << "Expense already paid.\n";
        return;
    }

    int pmChoice;
    cout << "\nSelect Payment Mode:\n";
    cout << "1. Cash (Galla)\n";
    cout << "2. UPI / Bank\n";
    cout << "Choice: ";
    cin >> pmChoice;

    if (pmChoice == 1) {
    if (!requestApproval(
            ApprovalType::CASH_EXPENSE,
            e.amount,
            e.description
        )) {
        cout << "Expense payment cancelled.\n";
        return;
    }

    e.paymentMode = PaymentMode::CASH;
    extern GallaState galla; // Phase 7 will remove this
deductFromGalla(galla, e.amount);
}

    e.isPaid = true;
    saveExpenses(expenses);

    cout << "Expense marked as PAID.\n";
}
