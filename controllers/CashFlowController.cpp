#include "CashFlowController.h"
#include <fstream>
#include <sstream>

using namespace std;

CashFlowResponse cashFlowController() {
    CashFlowResponse r{};

    // ---- Orders ----
    {
        ifstream file("orders.txt");
        string line;
        while (getline(file, line)) {
            if (line.rfind("TOTAL", 0) == 0) {
                string label, mode;
                float amt;
                char comma;
                stringstream ss(line);
                ss >> label >> comma >> amt >> comma >> mode;

                (mode == "CASH") ? r.cashIn += amt : r.bankIn += amt;
            }
        }
    }

    // ---- Withdrawals ----
    {
        ifstream file("cash_withdrawals.txt");
        string id, date;
        float amt;
        while (getline(file, id, ',')) {
            getline(file, date, ',');
            file >> amt;
            file.ignore();
            r.withdrawals += amt;
        }
    }

    // ---- Cash Expenses ----
    {
        ifstream file("expenses.txt");
        string id, desc, mode;
        float amt;
        int paid;
        while (getline(file, id, ',')) {
            getline(file, desc, ',');
            file >> amt >> paid >> mode;
            file.ignore();
            if (paid == 1 && mode == "CASH")
                r.cashExpenses += amt;
        }
    }

    r.netCash = r.cashIn - r.withdrawals - r.cashExpenses;
    return r;
}
