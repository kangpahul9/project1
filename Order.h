#ifndef ORDER_H
#define ORDER_H

#include <string>
#include"Menu.h"
struct OrderItem {
    std::string name;
    float price;
    int quantity;

    float total() const;
};

void addItemToOrder(
    std::vector<OrderItem>& order,
    const std::vector<MenuItem>& Menu
);

void viewOrder(
    const std::vector<OrderItem>& order
);

void printFinalBill(
    const std::vector<OrderItem>& order
);

void logOrder(
    const std::vector<OrderItem>& order
);



#endif