#include "CashMismatchController.h"
#include "../DailyCash.h"
#include <fstream>
#include <sstream>
#include <limits>

using namespace std;




/*
Accounting invariant:
- Cash mismatch is ONLY valid after day is closed
- expectedCash = openingCash + cashSales - cashExpenses - withdrawals
- difference must be 0 for MATCHED
*/
CashMismatchResponse cashMismatchController() {
    vector<DailyCash> records;
    loadDailyCash(records);

    CashMismatchResponse r{};
    if (records.empty()) return r;

    DailyCash d = records.back();
    if (!d.isClosed) return r;

    string reportDate = d.date;

    float cashSales = 0;
    float cashExpenses = 0;
    float withdrawals = 0;

    // =========================
    // Cash Sales (no date yet)
    // =========================
    // ---- Cash Sales (DATED FORMAT) ----
{
    ifstream f("orders.txt");
    string line;

    while (getline(f, line)) {
        if (line.rfind("TOTAL", 0) == 0) {
            string type, date, mode;
            float amt;

            stringstream ss(line);
            getline(ss, type, ',');   // TOTAL
            getline(ss, date, ',');   // YYYY-MM-DD
            ss >> amt;
            ss.ignore();              // comma
            ss >> mode;

            if (date != d.date) continue;   // 🔥 IMPORTANT

            if (mode == "CASH") {
                cashSales += amt;
            }
        }
    }
}


    // =========================
    // Cash Expenses (no date yet)
    // =========================
    {
        ifstream f("expenses.txt");
        string id, desc, mode;
        float amt;
        int paid;

        while (getline(f, id, ',')) {
            getline(f, desc, ',');
            f >> amt >> paid >> mode;
            f.ignore(numeric_limits<streamsize>::max(), '\n');

            if (paid == 1 && mode == "CASH") {
                cashExpenses += amt;
            }
        }
    }

    // =========================
    // Withdrawals (FILTERED)
    // =========================
    {
        ifstream f("cash_withdrawals.txt");
        string id, date;
        float amt;

        while (getline(f, id, ',')) {
            getline(f, date, ',');
            f >> amt;
            f.ignore(numeric_limits<streamsize>::max(), '\n');

            if (date == reportDate) {
                withdrawals += amt;
            }
        }
    }

    r.date = d.date;
    r.openingCash = d.openingCash;
    r.expectedCash =
        d.openingCash + cashSales - cashExpenses - withdrawals;
    r.closingCash = d.closingCash;
    r.difference = r.closingCash - r.expectedCash;

    return r;
}
