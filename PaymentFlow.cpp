#include "PaymentFlow.h"
#include <iostream>
#include <iomanip>

using namespace std;
bool processPayment(const vector<OrderItem>& order, GallaState& galla) {
    float total = 0;
    for (const auto& item : order) {
        total += item.total();
    }

    cout << "\nTotal Bill Amount: ₹"
         << fixed << setprecision(2) << total << endl;

    int mode;
    cout << "\nSelect Payment Mode:\n";
    cout << "1. Cash\n2. UPI\n3. Card\n4. Online\n";
    cout << "Choice: ";
    cin >> mode;

    PaymentMode selectedMode;
    switch (mode) {
        case 1: selectedMode = PaymentMode::CASH; break;
        case 2: selectedMode = PaymentMode::UPI; break;
        case 3: selectedMode = PaymentMode::CARD; break;
        case 4: selectedMode = PaymentMode::ONLINE; break;
        default:
            cout << "Invalid payment mode.\n";
            return false;
    }

    // 🔥 SET PAYMENT MODE ON ALL ORDER ITEMS
    for (auto& item : const_cast<vector<OrderItem>&>(order)) {
        item.paymentMode = selectedMode;
    }

    if (selectedMode != PaymentMode::CASH) {
        cout << "Payment received via non-cash method.\n";
        return true;
    }

    // ---- CASH FLOW ----
    float received;
    cout << "Enter cash received from customer: ₹";
    cin >> received;

    if (received < total) {
        cout << "❌ Insufficient cash received.\n";
        return false;
    }

    float change = received - total;

    addToGalla(galla, received);

    if (change > 0 && !deductFromGalla(galla, change)) {
        cout << "❌ Cannot return exact change.\n";
        return false;
    }

    cout << "Cash payment completed successfully.\n";
    return true;
}
