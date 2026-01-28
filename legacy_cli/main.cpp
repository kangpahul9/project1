#include <iostream>
#include <vector>
#include <iomanip>


#include "Menu.h"
#include "Order.h"
#include "Reports.h"
#include "StoreInventory.h"
#include "Staff.h"
#include "Expenses.h"
#include "Bills.h"
#include "Vendors.h"
#include "Auth.h"
#include "Cash.h"
#include "Payment.h"
#include "DailyCash.h"
#include "GallaState.h"
#include "PaymentFlow.h"
#include "controllers/DailyCashController.h"
#include "controllers/PaymentController.h"
#include "controllers/ExpenseController.h"
#include "controllers/WithdrawalController.h"
#include "controllers/CashFlowController.h"
#include "controllers/DailySalesController.h"
#include "controllers/CashMismatchController.h"


using namespace std;

int main() {
    // ---- Core Data ----
    vector<MenuItem> menu;
    vector<OrderItem> order;
    vector<StoreItem> store;
    vector<Staff> staff;
    vector<Expense> expenses;
    vector<Bill> bills;
    vector<Vendor> vendors;
    vector<CashWithdrawal> withdrawals;
    vector<DailyCash> dailyCash;
    GallaState galla;


    // ---- Role Selection (TEMP AUTH) ----
    Role currentRole = selectRole();
    cout << (isAdmin(currentRole)
             ? "Admin access granted.\n"
             : "Staff access granted.\n");

    // ---- Load Data ----
    loadMenu(menu);
    loadStoreInventory(store);
    loadStaff(staff);
    loadExpenses(expenses);
    loadBills(bills);
    loadVendors(vendors);
    loadWithdrawals(withdrawals);
    loadDailyCash(dailyCash);

    // ---- Admin Guard ----
    auto requireAdmin = [&]() -> bool {
        if (!isAdmin(currentRole)) {
            cout << "Access denied. Admin only.\n";
            return false;
        }
        return true;
    };

    bool exitProgram = false;

    while (!exitProgram) {
        cout << "\n====== RESTAURANT POS ======\n";
        cout << "1.  Add Menu Item (Admin)\n";
        cout << "2.  Add Item to Order\n";
        cout << "3.  View Order\n";
        cout << "4.  Print Final Bill\n";
        cout << "5.  Daily Sales Report\n";
        cout << "6.  Exit\n";
        cout << "7.  Edit Menu Item Price (Admin)\n";
        cout << "8.  View Store Inventory\n";
        cout << "9.  Add Store Item (Admin)\n";
        cout << "10. Update Store Quantity (Admin)\n";
        cout << "11. View Staff\n";
        cout << "12. Add Staff (Admin)\n";
        cout << "13. View Expenses\n";
        cout << "14. Add Expense (Admin)\n";
        cout << "15. Profit & Loss Report\n";
        cout << "16. Use Store Item (Admin)\n";
        cout << "17. Mark Expense as Paid\n";
        cout << "18. View Bills\n";
        cout << "19. Add Bill (Admin)\n";
        cout << "20. Mark Bill as Paid\n";
        cout << "21. View Vendors\n";
        cout << "22. Add Vendor (Admin)\n";
        cout << "23. View Cash Withdrawals (Admin)\n";
        cout << "24. Add Cash Withdrawal (Admin)\n";
        cout << "25. Cash Flow Report\n";
        cout << "26. Start Day (Opening Cash)\n";
        cout << "27. Close Day (Closing Cash)\n";
        cout << "28. View Daily Cash Records\n";
        cout << "29. Cash Mismatch Report\n";
        cout << "Choice: ";

        int choice;
        cin >> choice;

        switch (choice) {

        case 1:
            if (!requireAdmin()) break;
            addMenuItem(menu);
            break;

        case 2:
            addItemToOrder(order, menu);
            break;

        case 3:
            viewOrder(order);
            break;

        case 4: {
    if (order.empty()) {
        cout << "Order is empty. Nothing to bill.\n";
        break;
    }

    char confirm;
    cout << "Confirm checkout? (y/n): ";
    cin >> confirm;
    if (confirm != 'y' && confirm != 'Y') {
        cout << "Checkout cancelled.\n";
        break;
    }

    printFinalBill(order);

    int mode;
    cout << "\nSelect Payment Mode:\n";
    cout << "1. Cash\n2. UPI\n3. Card\n4. Online\n";
    cout << "Choice: ";
    cin >> mode;

    PaymentRequest req;
    req.mode = static_cast<PaymentMode>(mode);

    if (req.mode == PaymentMode::CASH) {
        cout << "Enter cash received: ₹";
        cin >> req.cashReceived;
    } else {
        req.cashReceived = 0;
    }

    auto res = processPaymentController(order, galla, req);

    if (!res.success) {
        cout << "❌ " << res.message << endl;
        break;
    }

    cout << "✅ " << res.message << endl;
    if (res.changeReturned > 0) {
        cout << "Change returned: ₹"
             << fixed << setprecision(2)
             << res.changeReturned << endl;
    }

    logOrder(order);
    order.clear();

    cout << "Order completed.\n";
    break;
}

        case 5: {
    auto r = dailySalesController();

    cout << "Orders: " << r.orders << endl;
    cout << "Revenue: ₹" << fixed << setprecision(2) << r.revenue << endl;
    cout << "Best Seller: " << r.bestSeller
         << " (" << r.bestSellerQty << ")\n";
    break;
}

        case 6:
            exitProgram = true;
            break;

        case 7:
            if (!requireAdmin()) break;
            editMenuItemPrice(menu);
            break;

        case 8:
            showStoreInventory(store);
            break;

        case 9:
            if (!requireAdmin()) break;
            addStoreItem(store);
            break;

        case 10:
            if (!requireAdmin()) break;
            updateStoreItemQuantity(store);
            break;

        case 11:
            showStaff(staff);
            break;

        case 12:
            if (!requireAdmin()) break;
            addStaff(staff);
            break;

        case 13:
            showExpenses(expenses);
            break;

        case 14:
            if (!requireAdmin()) break;
            addExpense(expenses);
            break;

        case 15:
            profitAndLossReport();
            break;

        case 16:
            if (!requireAdmin()) break;
            useStoreItem(store);
            break;

        case 17: {
    string expId;
    cout << "Enter Expense ID: ";
    cin >> expId;

    int m;
    cout << "Payment Mode (1=CASH, 2=UPI): ";
    cin >> m;

    PayExpenseRequest req{
        expId,
        static_cast<PaymentMode>(m)
    };

    auto res = payExpenseController(expenses, galla, req);
    cout << res.message << endl;
    break;
}

        case 18:
            showBills(bills);
            break;

        case 19:
            if (!requireAdmin()) break;
            addBill(bills);
            break;

        case 20:
            markBillPaid(bills);
            break;

        case 21:
            showVendors(vendors);
            break;

        case 22:
            if (!requireAdmin()) break;
            addVendor(vendors);
            break;

        case 23:
            if (!requireAdmin()) break;
            showWithdrawals(withdrawals);
            break;

        case 24: {
    WithdrawalRequest req;
    cout << "Date (YYYY-MM-DD): ";
    cin >> req.date;
    cout << "Amount: ";
    cin >> req.amount;

    auto res = withdrawalController(withdrawals, galla, req);
    cout << res.message << endl;
    break;
}

        case 25: {
    if (!requireAdmin()) break;

    auto r = cashFlowController();
    cout << "Cash In: ₹" << r.cashIn << endl;
    cout << "Bank In: ₹" << r.bankIn << endl;
    cout << "Withdrawals: ₹" << r.withdrawals << endl;
    cout << "Cash Expenses: ₹" << r.cashExpenses << endl;
    cout << "Net Cash: ₹" << r.netCash << endl;
    break;
}

case 26: {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    StartDayRequest req;
    cout << "Enter date (YYYY-MM-DD): ";
    getline(cin, req.date);

    cout << "Enter opening denominations:\n";
    inputDenominations(req.openingDenoms);

    auto res = startDayController(dailyCash, req);

    galla.denoms = req.openingDenoms;

    cout << "Opening Cash: ₹"
         << fixed << setprecision(2)
         << res.openingCash << endl;

    if (res.mismatchWarning) {
        cout << "⚠️ WARNING: Opening cash does not match previous closing!\n";
    }

    break;
}

case 27: {
    auto result = closeDayController(dailyCash, galla);

    if (!result.success) {
        cout << "❌ " << result.message << endl;
    } else {
        cout << "✅ " << result.message << endl;
        cout << "Closing Cash: ₹"
             << fixed << setprecision(2)
             << result.closingCash << endl;
    }
    break;
}

case 28:
    if (!requireAdmin()) break;
    showDailyCash(dailyCash);
    break;

case 29: {
    auto r = cashMismatchController();

    cout << "Date: " << r.date << endl;
    cout << "Opening: ₹" << r.openingCash << endl;
    cout << "Expected: ₹" << r.expectedCash << endl;
    cout << "Closing: ₹" << r.closingCash << endl;
    cout << "Diff: ₹" << r.difference << endl;
    break;
}
        default:
            cout << "Invalid choice.\n";
        }
    }

    return 0;
}
