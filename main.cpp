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


using namespace std;

int main()
{
    vector<MenuItem> Menu;
    vector<OrderItem> order;
    vector<StoreItem> store; // ✅ STORE ROOM DATA
    vector<Staff> staff;
    vector<Expense> expenses;
vector<Bill> bills;
vector<Vendor> vendors;

    loadMenu(Menu);
    loadStoreInventory(store); // ✅ LOAD STORE INVENTORY
    loadStaff(staff);
    loadExpenses(expenses);
loadBills(bills);
loadVendors(vendors);


    bool exitProgram = false;

    while (!exitProgram)
    {
        cout << "\n====== RESTAURANT POS ======\n";
        cout << "1. Add Menu Item\n";
        cout << "2. Add Item to Order\n";
        cout << "3. View Order\n";
        cout << "4. Print Final Bill\n";
        cout << "5. Daily Sales Report\n";
        cout << "6. Exit\n";
        cout << "7. Edit Menu Item Price (Admin)\n";
        cout << "8. View Store Inventory\n";
        cout << "9. Add Store Item (Admin)\n";
        cout << "10. Update Store Quantity\n";
        cout << "11. View Staff\n";
        cout << "12. Add Staff (Admin)\n";
        cout << "13. View Expenses\n";
        cout << "14. Add Expense (Admin)\n";
        cout << "15. Profit & Loss Report\n";
        cout << "16. Use Store Item (Create Expense)\n";
        cout << "17. Mark Expense as Paid\n";
        cout << "18. View Bills\n";
        cout << "19. Add Bill (Admin)\n";
        cout << "20. Mark Bill as Paid\n";
        cout << "21. View Vendors\n";
        cout << "22. Add Vendor (Admin)\n";

        cout << "Choice: ";

        int choice;
        cin >> choice;

        switch (choice)
        {
        case 1:
            addMenuItem(Menu);
            break;

        case 2:
            addItemToOrder(order, Menu);
            break;

        case 3:
            viewOrder(order);
            break;

        case 4:
        {
            if (order.empty())
            {
                cout << "Order is empty. Nothing to bill.\n";
                break;
            }

            char confirm;
            cout << "Confirm checkout? (y/n): ";
            cin >> confirm;

            if (confirm == 'y' || confirm == 'Y')
            {
                printFinalBill(order);
                logOrder(order);
                order.clear();
                cout << "Order completed.\n";
            }
            else
            {
                cout << "Checkout cancelled.\n";
            }
            break;
        }

        case 5:
            dailySalesReport();
            break;

        case 7:
            editMenuItemPrice(Menu);
            break;

        case 8:
            showStoreInventory(store); // ✅ USE STORE
            break;

        case 9:
            addStoreItem(store); // ✅ USE STORE
            break;

        case 6:
            exitProgram = true;
            break;
        case 10:
            updateStoreItemQuantity(store);
            break;
        case 11:
            showStaff(staff);
            break;

        case 12:
            addStaff(staff);
            break;
        case 13:
            showExpenses(expenses);
            break;

        case 14:
            addExpense(expenses);
            break;
        case 15:
            profitAndLossReport();
            break;
        case 16:
            useStoreItem(store);
            break;
        case 17:
        markExpensePaid(expenses);
        break;
        case 18:
    showBills(bills);
    break;

case 19:
    addBill(bills);
    break;
    case 20:
    markBillPaid(bills);
    break;
    case 21:
    showVendors(vendors);
    break;

case 22:
    addVendor(vendors);
    break;
        default:
            cout << "Invalid choice.\n";
        }
    }

    return 0;
}
