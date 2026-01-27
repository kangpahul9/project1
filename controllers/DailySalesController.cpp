#include "DailySalesController.h"
#include <fstream>
#include <sstream>
#include <map>

using namespace std;

DailySalesResponse dailySalesController() {
    ifstream file("orders.txt");

    DailySalesResponse res{};
    map<string, int> itemCount;

    string line;
    while (getline(file, line)) {

        if (line == "---") {
            res.orders++;
        }
        else if (line.rfind("TOTAL", 0) == 0) {
            string label, mode;
            float total;
            char comma;

            stringstream ss(line);
            ss >> label >> comma >> total >> comma >> mode;
            res.revenue += total;
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

    for (auto& p : itemCount) {
        if (p.second > res.bestSellerQty) {
            res.bestSellerQty = p.second;
            res.bestSeller = p.first;
        }
    }

    return res;
}
