#include "CashFlowController.h"
#include "../DailyCash.h"
#include <fstream>
#include <sstream>
#include <limits>

using namespace std;

CashFlowResponse cashFlowController() {
    CashFlowResponse r{};

    // =========================
    // Get last closed date
    // =========================
    vector<DailyCash> records;
    loadDailyCash(records);

    if (records.empty()) return r;

    DailyCash d = records.back();
    if (!d.isClosed) return r;

    string reportDate = d.date;

    // =========================
    // Orders (no date info yet)
    // =========================
    {
        ifstream file("orders.txt");
        string line;
        while (getline(file, line)) {
            if (line.rfind("TOTAL", 0) == 0) {
    string type, date, mode;
    float amt;

    stringstream ss(line);
    getline(ss, type, ',');   // TOTAL
    getline(ss, date, ',');   // YYYY-MM-DD
    ss >> amt;
    ss.ignore();              // comma
    ss >> mode;

    if (mode == "CASH") {
        r.cashIn += amt;
    } else {
        r.bankIn += amt;
    }
}
        }
    }

    // =========================
    // Withdrawals (FILTERED)
    // =========================
    {
        ifstream file("cash_withdrawals.txt");
        string id, date;
        float amt;

        while (getline(file, id, ',')) {
            getline(file, date, ',');
            file >> amt;
            file.ignore(numeric_limits<streamsize>::max(), '\n');

            if (date == reportDate) {
                r.withdrawals += amt;
            }
        }
    }

    // =========================
    // Cash Expenses (no date yet)
    // =========================
    {
        ifstream file("expenses.txt");
        string id, desc, mode;
        float amt;
        int paid;

        while (getline(file, id, ',')) {
            getline(file, desc, ',');
            file >> amt >> paid >> mode;
            file.ignore(numeric_limits<streamsize>::max(), '\n');

            if (paid == 1 && mode == "CASH") {
                r.cashExpenses += amt;
            }
        }
    }

    r.netCash = r.cashIn - r.withdrawals - r.cashExpenses;
    return r;
}
