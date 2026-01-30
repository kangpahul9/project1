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

    string type, date;
    float amount;

    while (getline(file, type, ',')) {
        getline(file, date, ',');
        file >> amount;
        file.ignore(numeric_limits<streamsize>::max(), '\n');

        withdrawals.push_back({
            generateId("WD"),
            date,
            amount
        });
    }
}

void saveWithdrawals(const vector<CashWithdrawal>& withdrawals) {
    ofstream file("cash_withdrawals.txt");

    for (const auto& w : withdrawals) {
        file << "WD," << w.date << ","
             << w.amount << "\n";
    }
}


void showWithdrawals(const vector<CashWithdrawal> &withdrawals)
{
    if (withdrawals.empty())
    {
        cout << "No cash withdrawals recorded.\n";
        return;
    }

    float total = 0;

    cout << "\n====== CASH WITHDRAWALS (GALLA) ======\n";
    cout << left << setw(12) << "Date"
         << "Amount\n";
    cout << "----------------------------\n";

    for (const auto &w : withdrawals)
    {
        cout << left << setw(12) << w.date
             << fixed << setprecision(2)
             << w.amount << endl;
        total += w.amount;
    }

    cout << "\nTotal Cash Withdrawn: "
         << fixed << setprecision(2)
         << total << endl;
}

void addWithdrawal(vector<CashWithdrawal> &withdrawals)
{
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    CashWithdrawal w;
    w.id = generateId("WD");

    cout << "Enter date (YYYY-MM-DD): ";
    getline(cin, w.date);

    cout << "Enter amount withdrawn: ";
    while (!(cin >> w.amount) || w.amount <= 0)
    {
        cout << "Invalid amount. Enter again: ";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
    }
    if (!requestApproval(
            ApprovalType::WITHDRAWAL,
            w.amount,
            "Cash withdrawal from galla"))
    {
        cout << "Withdrawal cancelled.\n";
        return;
    }
    withdrawals.push_back(w);
    saveWithdrawals(withdrawals);
    GallaState galla;
deductFromGalla(galla, w.amount);

    cout << "Cash withdrawal recorded.\n";
}
