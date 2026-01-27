#ifndef BILLS_H
#define BILLS_H

#include <string>
#include <vector>
#include "Utils.h"

struct Bill {
    std::string id;
    std::string vendor;
    float amount;
    std::string filePath;   // path to bill PDF/image
    bool isPaid;
};

void loadBills(std::vector<Bill>& bills);
void saveBills(const std::vector<Bill>& bills);
void showBills(const std::vector<Bill>& bills);
void addBill(std::vector<Bill>& bills);
void markBillPaid(std::vector<Bill>& bills);

#endif
