#include "CashMismatchController.h"
#include "../DailyCash.h"
#include <fstream>
#include <sstream>
#include <limits>

using namespace std;

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
