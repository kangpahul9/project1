#include "DailyCash.h"
#include <iostream>
#include <fstream>
#include <limits>
#include <iomanip>

using namespace std;

void loadDailyCash(vector<DailyCash>& records) {
    ifstream file("daily_cash.txt");
    if (!file) return;

    DailyCash d;
    int closed;

    while (getline(file, d.date, ',')) {
        file >> d.openingCash >> d.closingCash >> closed;
        d.isClosed = (closed == 1);

        // NOTE: Denominations are not persisted yet (Phase 5.2+)
        d.openingDenoms.clear();
        d.closingDenoms.clear();

        file.ignore(numeric_limits<streamsize>::max(), '\n');
        records.push_back(d);
    }
}

void saveDailyCash(const vector<DailyCash>& records) {
    ofstream file("daily_cash.txt");

    for (const auto& d : records) {
        file << d.date << ","
             << d.openingCash << " "
             << d.closingCash << " "
             << (d.isClosed ? 1 : 0)
             << "\n";
    }
}

void startDay(vector<DailyCash>& records) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    // ---- Enforce previous day closure ----
    if (!records.empty()) {
        const DailyCash& last = records.back();
        if (!last.isClosed) {
            cout << "Previous day is not closed. Cannot start new day.\n";
            return;
        }

        cout << "Previous day closing cash: ₹"
             << fixed << setprecision(2)
             << last.closingCash << endl;
    }

    DailyCash d;
    cout << "Enter date (YYYY-MM-DD): ";
    getline(cin, d.date);

    // Prevent duplicate start
    for (const auto& r : records) {
        if (r.date == d.date) {
            cout << "Day already started.\n";
            return;
        }
    }

    cout << "\nEnter OPENING CASH denominations:\n";
    inputDenominations(d.openingDenoms);
    d.openingCash = calculateTotal(d.openingDenoms);

    // ---- Validate opening vs previous closing ----
    if (!records.empty()) {
        const DailyCash& last = records.back();
        if (d.openingCash != last.closingCash) {
            cout << "\n⚠️ WARNING ⚠️\n";
            cout << "Opening cash (₹" << d.openingCash
                 << ") does NOT match previous closing (₹"
                 << last.closingCash << ")\n";
            cout << "Please verify galla cash.\n";
        }
    }

    d.closingCash = 0;
    d.isClosed = false;

    records.push_back(d);
    saveDailyCash(records);

    cout << "Day started successfully.\n";
}

void closeDay(vector<DailyCash>& records, const GallaState& galla) {
    if (records.empty()) {
        cout << "No active day found.\n";
        return;
    }

    DailyCash& d = records.back();
    if (d.isClosed) {
        cout << "Day already closed.\n";
        return;
    }

    // Take denominations from live galla
    d.closingDenoms = galla.denoms;
    d.closingCash = getGallaTotal(galla);

    d.isClosed = true;
    saveDailyCash(records);

    cout << "Day closed successfully.\n";
    cout << "Closing Cash (from galla): ₹"
         << fixed << setprecision(2)
         << d.closingCash << endl;
}

void showDailyCash(const vector<DailyCash>& records) {
    if (records.empty()) {
        cout << "No daily cash records.\n";
        return;
    }

    cout << "\n====== DAILY CASH RECORDS ======\n";
    for (const auto& d : records) {
        cout << d.date
             << " | Opening: ₹" << fixed << setprecision(2) << d.openingCash
             << " | Closing: ₹" << fixed << setprecision(2) << d.closingCash
             << " | Status: " << (d.isClosed ? "CLOSED" : "OPEN")
             << endl;
    }
}
