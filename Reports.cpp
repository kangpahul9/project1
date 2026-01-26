#include "Reports.h"

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
            string label;
            float total;
            char comma;

            stringstream ss(line);
            ss >> label >> comma >> total;
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

    // ---- Expenses ----
    {
        ifstream file("expenses.txt");
        string desc;
        float amount;

        while (getline(file, desc, ',')) {
            file >> amount;
            file.ignore(numeric_limits<streamsize>::max(), '\n');
            expenses += amount;
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
