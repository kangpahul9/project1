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

        // description (till comma)
        getline(ss, e.description, ',');

        // amount + paid flag
        ss >> e.amount >> paidFlag;
        e.isPaid = (paidFlag == 1);

        // optional payment mode
        string modeStr;
        if (ss >> modeStr) {
            if (modeStr == "CASH")
                e.paymentMode = PaymentMode::CASH;
            else
                e.paymentMode = PaymentMode::UPI; // bank-side default
        } else {
            // legacy expenses
            e.paymentMode = PaymentMode::CASH;
        }

        expenses.push_back(e);
    }
}


void saveExpenses(const vector<Expense>& expenses) {
    ofstream file("expenses.txt");

    for (const auto& e : expenses) {
        file << e.description << ","
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
        e.paymentMode = PaymentMode::CASH;
    } else {
        e.paymentMode = PaymentMode::UPI; // bank-side
    }

    e.isPaid = true;
    saveExpenses(expenses);

    cout << "Expense marked as PAID.\n";
}
