#include <iostream>
#include <vector>
#include <iomanip>
#include <fstream>
#include <limits>
#include <sstream>
#include <map>

using namespace std;

/* ---------- INVENTORY ---------- */
struct InventoryItem {
    string name;
    float price;
};

/* ---------- ORDER ITEM ---------- */
struct OrderItem {
    string name;
    float price;
    int quantity;

    float total() const {
        return price * quantity;
    }
};

/* ---------- INVENTORY FUNCTIONS ---------- */
void loadInventory(vector<InventoryItem>& inventory) {
    ifstream file("inventory.txt");
    if (!file) return;

    string name;
    float price;
    while (getline(file, name, ',')) {
        file >> price;
        file.ignore(numeric_limits<streamsize>::max(), '\n');
        inventory.push_back({name, price});
    }
}

void saveInventory(const vector<InventoryItem>& inventory) {
    ofstream file("inventory.txt");
    for (const auto& item : inventory) {
        file << item.name << "," << item.price << '\n';
    }
}

void showInventory(const vector<InventoryItem>& inventory) {
    cout << "\n------ menu ------\n";
    for (size_t i = 0; i < inventory.size(); i++) {
        cout << i + 1 << ". " << inventory[i].name
             << " - $" << fixed << setprecision(2)
             << inventory[i].price << endl;
    }
}

/* ---------- INVENTORY MANAGEMENT ---------- */
void addInventoryItem(vector<InventoryItem>& inventory) {
    cin.ignore(numeric_limits<streamsize>::max(), '\n');

    InventoryItem item;
    cout << "Enter item name: ";
    getline(cin, item.name);

    cout << "Enter price: ";
while (!(cin >> item.price) || item.price <= 0) {
    cout << "Invalid price. Enter again: ";
    cin.clear();
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
}

    inventory.push_back(item);
    saveInventory(inventory);

    cout << "Item added to inventory.\n";
}

/* ---------- ORDER FUNCTIONS ---------- */
void addItemToOrder(vector<OrderItem>& order, const vector<InventoryItem>& inventory) {
    if (inventory.empty()) {
        cout << "Inventory is empty.\n";
        return;
    }

    showInventory(inventory);

    int choice, qty;

    cout << "Select item number: ";
    if (!(cin >> choice) || choice < 1 || choice > inventory.size()) {
        cout << "Invalid item selection.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    cout << "Enter quantity: ";
    if (!(cin >> qty) || qty <= 0) {
        cout << "Invalid quantity.\n";
        cin.clear();
        cin.ignore(numeric_limits<streamsize>::max(), '\n');
        return;
    }

    const InventoryItem& inv = inventory[choice - 1];

    // 🔁 Merge logic
    for (auto& item : order) {
        if (item.name == inv.name) {
            item.quantity += qty;
            cout << "Updated quantity for " << inv.name << ".\n";
            return;
        }
    }

    // If not found, add new
    order.push_back({inv.name, inv.price, qty});
    cout << "Item added to order.\n";
}


void viewOrder(const vector<OrderItem>& order) {
    if (order.empty()) {
        cout << "Order is empty.\n";
        return;
    }

    float total = 0;
    cout << "\nItem | Price | Qty | Total\n";
    cout << "---------------------------\n";

    for (const auto& item : order) {
cout << left << setw(15) << item.name << " | "
             << fixed << setprecision(2) << item.price << " | "
             << item.quantity << " | "
             << fixed << setprecision(2) << item.total() << endl;
        total += item.total();
    }

    cout << "\nCurrent Total: $" << fixed << setprecision(2) << total << endl;
}

/* ---------- FINAL BILL + SALES LOG ---------- */
void logOrder(const vector<OrderItem>& order) {
    ofstream file("orders.txt", ios::app);
    float total = 0;

    for (const auto& item : order) {
        file << item.name << "," << item.quantity << "," << item.price << '\n';
        total += item.total();
    }
    file << "TOTAL," << fixed << setprecision(2) << total << '\n';
    file << "---\n";
}

void printFinalBill(const vector<OrderItem>& order) {
    float total = 0;

    cout << "\n====== FINAL BILL ======\n";
    for (const auto& item : order) {
        cout << item.name << " x" << item.quantity
             << " = $" << fixed << setprecision(2)
             << item.total() << endl;
        total += item.total();
    }

    cout << "\nGrand Total: $" << fixed << setprecision(2) << total << endl;
}

/* ---------- DAILY SALES ---------- */
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
        if (line == "---") orders++;
        else if (line.rfind("TOTAL", 0) == 0) {
            string label;
            float total;
            char comma;
            stringstream ss(line);
            ss >> label >> comma >> total;
            revenue += total;
        } else {
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

    cout << "Best Seller: " << best << " (" << maxQty << " sold)\n";
}

/* ---------- MAIN ---------- */
int main() {
    vector<InventoryItem> inventory;
    vector<OrderItem> order;

    loadInventory(inventory);

    bool exit = false;
    while (!exit) {
        cout << "\n====== RESTAURANT POS ======\n";
        cout << "1. Add Inventory Item\n";
        cout << "2. Add Item to Order\n";
        cout << "3. View Order\n";
        cout << "4. Print Final Bill\n";
        cout << "5. Daily Sales Report\n";
        cout << "6. Exit\n";
        cout << "Choice: ";

        int choice;
        cin >> choice;

        switch (choice) {
            case 1: addInventoryItem(inventory); break;
            case 2: addItemToOrder(order, inventory); break;
            case 3: viewOrder(order); break;
            case 4:
            char confirm;
cout << "Confirm checkout? (y/n): ";
cin >> confirm;
if (confirm == 'y' || confirm == 'Y') {
if (order.empty()) {
        cout << "Order is empty. Nothing to bill.\n";
        break;
    }
    printFinalBill(order);
    logOrder(order);
    order.clear();
    break;
}
else {
    cout << "Checkout cancelled.\n";
}            break;
                
            case 5: dailySalesReport(); break;
            case 6: exit = true; break;
            default: cout << "Invalid choice.\n";
        }
    }

    return 0;
}
