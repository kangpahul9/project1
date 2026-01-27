#ifndef ORDER_H
#define ORDER_H

#include <string>
#include"Menu.h"
#include "Payment.h"
#include "Utils.h"


struct OrderItem {
    std::string id;
    std::string name;
    float price;
    int quantity;
    PaymentMode paymentMode;
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