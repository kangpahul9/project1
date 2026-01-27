#include "Approval.h"
#include <iostream>

using namespace std;

// TEMP mock approval system (Phase 7 → OTP)
bool requestApproval(
    ApprovalType type,
    float amount,
    const string& reason
) {
    cout << "\n🔐 Approval Required 🔐\n";
    cout << "Reason: " << reason << endl;
    cout << "Amount: ₹" << amount << endl;

    char approve;
    cout << "Admin approval required (y/n): ";
    cin >> approve;

    if (approve == 'y' || approve == 'Y') {
        cout << "✅ Approved.\n";
        return true;
    }

    cout << "❌ Approval denied.\n";
    return false;
}
