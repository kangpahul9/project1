#include "Cash.h"

#include <iostream>
#include <fstream>
#include <iomanip>
#include <limits>

using namespace std;

/* ---------- CASH WITHDRAWALS ---------- */

void loadWithdrawals(vector<CashWithdrawal>& withdrawals) {
    ifstream file("cash_withdrawals.txt");
    if (!file) return;

    CashWithdrawal w;

    while (getline(file, w.date, ',')) {
        file >> w.amount;
        file.ignore(numeric_limits<streamsize>::max(), '\n');
        withdrawals.push_back(w);
    }
}

void saveWithdrawals(const vector<CashWithdrawal>& withdrawals) {
    ofstream file("cash_withdrawals.txt");

    for (const auto& w : withdrawals) {
        file << w.date << "," << w.amount << "\n";
    }
}

void showWithdrawals(const vector<CashWithdrawal>& withdrawals) {
    if (withdrawals.empty()) {
        cout << "No cash withdrawals recorded.\n";
        return;
    }

    float total = 0;

    cout << "\n====== CASH WITHDRAWALS (GALLA) ======\n";
    cout << left << setw(12) << "Date"
         << "Amount\n";
    cout << "----------------------------\n";

    for (const auto& w : withdrawals) {
        cout << left << setw(12) << w.date
             << fixed << setprecision(2)
             << w.amount << endl;
        total += w.amount;
    }

    cout << "\nTotal Cash Withdrawn: "
         << fixed << setprecision(2)
         << total << endl;
}

void addWithdrawal(vector<CashWithdrawal>& withdrawals) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    CashWithdrawal w;

    cout << "Enter date (YYYY-MM-DD): ";
    getline(cin, w.date);

    cout << "Enter amount withdrawn: ";
    while (!(cin >> w.amount) || w.amount <= 0) {
        cout << "Invalid amount. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }

    withdrawals.push_back(w);
    saveWithdrawals(withdrawals);

    cout << "Cash withdrawal recorded.\n";
}
