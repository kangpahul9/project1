#ifndef DAILY_SALES_CONTROLLER_H
#define DAILY_SALES_CONTROLLER_H

#include <string>
#include <vector>

struct ItemSale {
    std::string name;
    int quantity;
};

struct DailySalesResponse {
    int orders;
    float revenue;
    std::string bestSeller;
    int bestSellerQty;
};

DailySalesResponse dailySalesController();

#endif
