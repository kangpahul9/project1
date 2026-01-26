#include <iostream>
#include <vector>

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



using namespace std;

int main()
{
    vector<MenuItem> menu;
    vector<OrderItem> order;
    vector<StoreItem> store;
    vector<Staff> staff;
    vector<Expense> expenses;
    vector<Bill> bills;
    vector<Vendor> vendors;
    vector<CashWithdrawal> withdrawals;


    // ---- Role Selection (TEMPORARY AUTH) ----
    Role currentRole = selectRole();
    cout << (isAdmin(currentRole) ? "Admin access granted.\n"
                                  : "Staff access granted.\n");

    // ---- Load Data ----
    loadMenu(menu);
    loadStoreInventory(store);
    loadStaff(staff);
    loadExpenses(expenses);
    loadBills(bills);
    loadVendors(vendors);
    loadWithdrawals(withdrawals);


    // ---- Admin Guard ----
    auto requireAdmin = [&](void) -> bool {
        if (!isAdmin(currentRole)) {
            cout << "Access denied. Admin only.\n";
            return false;
        }
        return true;
    };

    bool exitProgram = false;

    while (!exitProgram)
    {
        cout << "\n====== RESTAURANT POS ======\n";
        cout << "1. Add Menu Item (Admin)\n";
        cout << "2. Add Item to Order\n";
        cout << "3. View Order\n";
        cout << "4. Print Final Bill\n";
        cout << "5. Daily Sales Report\n";
        cout << "6. Exit\n";
        cout << "7. Edit Menu Item Price (Admin)\n";
        cout << "8. View Store Inventory\n";
        cout << "9. Add Store Item (Admin)\n";
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

        cout << "Choice: ";

        int choice;
        cin >> choice;

        switch (choice)
        {
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

    // 1️⃣ Print bill first
    printFinalBill(order);

    // 2️⃣ Ask payment mode AFTER showing bill
    int pmChoice;
    cout << "\nSelect Payment Mode:\n";
    cout << "1. Cash\n";
    cout << "2. UPI\n";
    cout << "3. Card\n";
    cout << "4. Online\n";
    cout << "Choice: ";
    cin >> pmChoice;

    PaymentMode mode = PaymentMode::CASH;
    if (pmChoice >= 1 && pmChoice <= 4) {
        mode = static_cast<PaymentMode>(pmChoice);
    } else {
        cout << "Invalid choice. Defaulting to CASH.\n";
    }

    //  Assign payment mode to order
    for (auto& item : order) {
        item.paymentMode = mode;
    }

    // Log + clear
    logOrder(order);
    order.clear();

    cout << "Order completed.\n";
    break;
}

        case 5:
            dailySalesReport();
            break;

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

        case 17:
            markExpensePaid(expenses);
            break;

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

case 24:
    if (!requireAdmin()) break;
    addWithdrawal(withdrawals);
    break;
    case 25:
    cashFlowReport();
    break;

        default:
            cout << "Invalid choice.\n";
        }
    }

    return 0;
}
