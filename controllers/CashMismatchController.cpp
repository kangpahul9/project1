#include "CashMismatchController.h"
#include "../DailyCash.h"
#include <fstream>
#include <sstream>

using namespace std;

CashMismatchResponse cashMismatchController() {
    vector<DailyCash> records;
    loadDailyCash(records);

    CashMismatchResponse r{};
    if (records.empty()) return r;

    DailyCash d = records.back();
    if (!d.isClosed) return r;

    float cashSales = 0, cashExpenses = 0, withdrawals = 0;

    // ---- Cash Sales ----
    {
        ifstream f("orders.txt");
        string line;
        while (getline(f, line)) {
            if (line.rfind("TOTAL", 0) == 0) {
                string label, mode;
                float amt;
                char comma;
                stringstream ss(line);
                ss >> label >> comma >> amt >> comma >> mode;
                if (mode == "CASH") cashSales += amt;
            }
        }
    }

    // ---- Expenses ----
    {
        ifstream f("expenses.txt");
        string id, desc, mode;
        float amt;
        int paid;
        while (getline(f, id, ',')) {
            getline(f, desc, ',');
            f >> amt >> paid >> mode;
            f.ignore();
            if (paid == 1 && mode == "CASH")
                cashExpenses += amt;
        }
    }

    // ---- Withdrawals ----
    {
        ifstream f("cash_withdrawals.txt");
        string id, date;
        float amt;
        while (getline(f, id, ',')) {
            getline(f, date, ',');
            f >> amt;
            f.ignore();
            withdrawals += amt;
        }
    }

    r.date = d.date;
    r.openingCash = d.openingCash;
    r.expectedCash = d.openingCash + cashSales - cashExpenses - withdrawals;
    r.closingCash = d.closingCash;
    r.difference = r.closingCash - r.expectedCash;

    return r;
}
