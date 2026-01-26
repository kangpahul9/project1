#include "Reports.h"
#include "Payment.h"
#include <fstream>
#include <iostream>
#include <fstream>
#include <sstream>
#include <map>
#include <iomanip>

using namespace std;

/* ---------- DAILY SALES REPORT ---------- */

void dailySalesReport() {
    ifstream file("orders.txt");
    if (!file) {
        cout << "No sales data.\n";
        return;
    }

    string line;
    float revenue = 0;
    int orders = 0;
    map<string, int> itemCount;

    while (getline(file, line)) {
        if (line == "---") {
            orders++;
        }
        else if (line.rfind("TOTAL", 0) == 0) {
    string label, mode;
    float total;
    char comma;

    stringstream ss(line);
    ss >> label >> comma >> total >> comma >> mode;
    revenue += total;
}
        else {
            string name;
            int qty;
            float price;
            char comma;

            stringstream ss(line);
            getline(ss, name, ',');
            ss >> qty >> comma >> price;

            itemCount[name] += qty;
        }
    }

    cout << "\n====== DAILY SALES REPORT ======\n";
    cout << "Orders: " << orders << endl;
    cout << "Revenue: $" << fixed << setprecision(2) << revenue << endl;

    string best;
    int maxQty = 0;

    for (auto& p : itemCount) {
        if (p.second > maxQty) {
            maxQty = p.second;
            best = p.first;
        }
    }

    if (!best.empty()) {
        cout << "Best Seller: " << best
             << " (" << maxQty << " sold)\n";
    } else {
        cout << "No items sold.\n";
    }
}

void profitAndLossReport() {
    float revenue = 0;
    float expenses = 0;
    float salaries = 0;

    // ---- Revenue from orders ----
    {
        ifstream file("orders.txt");
        string line;

        while (getline(file, line)) {
            if (line.rfind("TOTAL", 0) == 0) {
                string label;
                float total;
                char comma;
                stringstream ss(line);
                ss >> label >> comma >> total;
                revenue += total;
            }
        }
    }

    // ---- Paid Expenses ----
{
    ifstream file("expenses.txt");
    string desc;
    float amount;
    int paidFlag;

    while (getline(file, desc, ',')) {
        file >> amount >> paidFlag;
        file.ignore(numeric_limits<streamsize>::max(), '\n');

        if (paidFlag == 1) {
            expenses += amount;
        }
    }
}

    // ---- Salaries ----
    {
        ifstream file("staff.txt");
        string name, role;
        float salary;

        while (getline(file, name, ',')) {
            getline(file, role, ',');
            file >> salary;
            file.ignore(numeric_limits<streamsize>::max(), '\n');
            salaries += salary;
        }
    }

    float profit = revenue - expenses - salaries;

    cout << "\n====== PROFIT & LOSS REPORT ======\n";
    cout << "Revenue:   " << fixed << setprecision(2) << revenue << endl;
    cout << "Expenses:  " << fixed << setprecision(2) << expenses << endl;
    cout << "Salaries:  " << fixed << setprecision(2) << salaries << endl;
    cout << "-------------------------------\n";
    cout << "Net Profit: " << fixed << setprecision(2) << profit << endl;
}

void cashFlowReport() {
    float cashIn = 0;
    float bankIn = 0;
    float gallaWithdrawals = 0;
    float cashExpenses = 0;

    // ---- Read orders ----
    {
        ifstream file("orders.txt");
        string line;

        while (getline(file, line)) {
            if (line.rfind("TOTAL", 0) == 0) {
                string label, mode;
                float amount;
                char comma;

                stringstream ss(line);
                ss >> label >> comma >> amount >> comma >> mode;

                if (mode == "CASH") {
                    cashIn += amount;
                } else {
                    bankIn += amount;
                }
            }
        }
    }

    // ---- Galla withdrawals ----
    {
        ifstream file("cash_withdrawals.txt");
        string date;
        float amount;

        while (getline(file, date, ',')) {
            file >> amount;
            file.ignore(numeric_limits<streamsize>::max(), '\n');
            gallaWithdrawals += amount;
        }
    }

    // ---- Paid CASH expenses ----
    {
        ifstream file("expenses.txt");
        string desc, mode;
        float amount;
        int paidFlag;

        while (getline(file, desc, ',')) {
            file >> amount >> paidFlag >> mode;
            file.ignore(numeric_limits<streamsize>::max(), '\n');

            if (paidFlag == 1 && mode == "CASH") {
                cashExpenses += amount;
            }
        }
    }

    float netCash = cashIn - gallaWithdrawals - cashExpenses;

    cout << "\n====== CASH FLOW REPORT ======\n";
    cout << "Cash Sales (Galla):     " << fixed << setprecision(2) << cashIn << endl;
    cout << "Bank Sales (UPI/Card):  " << fixed << setprecision(2) << bankIn << endl;
    cout << "---------------------------------\n";
    cout << "Galla Withdrawals:      " << fixed << setprecision(2) << gallaWithdrawals << endl;
    cout << "Cash Expenses Paid:     " << fixed << setprecision(2) << cashExpenses << endl;
    cout << "---------------------------------\n";
    cout << "Net Cash in Galla:      " << fixed << setprecision(2) << netCash << endl;
}

#include "DailyCash.h"

void cashMismatchReport() {
    ifstream dcFile("daily_cash.txt");
    if (!dcFile) {
        cout << "No daily cash data found.\n";
        return;
    }

    DailyCash d;
    int closed;
    bool found = false;

    // Take last closed day
    vector<DailyCash> records;
    while (getline(dcFile, d.date, ',')) {
        dcFile >> d.openingCash >> d.closingCash >> closed;
        d.isClosed = (closed == 1);
        dcFile.ignore(numeric_limits<streamsize>::max(), '\n');
        records.push_back(d);
    }

    if (records.empty()) {
        cout << "No daily records available.\n";
        return;
    }

    d = records.back();
    if (!d.isClosed) {
        cout << "Day is not closed yet. Close the day first.\n";
        return;
    }

    float cashSales = 0;
    float cashExpenses = 0;
    float withdrawals = 0;

    // ---- Cash sales ----
    {
        ifstream file("orders.txt");
        string line;

        while (getline(file, line)) {
            if (line.rfind("TOTAL", 0) == 0) {
                string label, mode;
                float amount;
                char comma;
                stringstream ss(line);
                ss >> label >> comma >> amount >> comma >> mode;
                if (mode == "CASH") {
                    cashSales += amount;
                }
            }
        }
    }

    // ---- Cash expenses ----
    {
        ifstream file("expenses.txt");
        string desc, mode;
        float amount;
        int paid;

        while (getline(file, desc, ',')) {
            file >> amount >> paid >> mode;
            file.ignore(numeric_limits<streamsize>::max(), '\n');
            if (paid == 1 && mode == "CASH") {
                cashExpenses += amount;
            }
        }
    }

    // ---- Withdrawals ----
    {
        ifstream file("cash_withdrawals.txt");
        string date;
        float amount;

        while (getline(file, date, ',')) {
            file >> amount;
            file.ignore(numeric_limits<streamsize>::max(), '\n');
            withdrawals += amount;
        }
    }

    float expectedCash =
        d.openingCash + cashSales - cashExpenses - withdrawals;

    float mismatch = d.closingCash - expectedCash;

    cout << "\n====== CASH MISMATCH REPORT ======\n";
    cout << "Date:           " << d.date << endl;
    cout << "Opening Cash:   " << fixed << setprecision(2) << d.openingCash << endl;
    cout << "Cash Sales:     " << cashSales << endl;
    cout << "Cash Expenses:  " << cashExpenses << endl;
    cout << "Withdrawals:    " << withdrawals << endl;
    cout << "---------------------------------\n";
    cout << "Expected Cash:  " << expectedCash << endl;
    cout << "Closing Cash:   " << d.closingCash << endl;
    cout << "---------------------------------\n";

    if (mismatch == 0) {
        cout << "Status: PERFECT MATCH ✅\n";
    } else if (mismatch > 0) {
        cout << "Extra Cash:     +" << mismatch << "\n";
    } else {
        cout << "Short Cash:     " << mismatch << "\n";
    }
}
