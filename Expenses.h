#ifndef EXPENSES_H
#define EXPENSES_H

#include <string>
#include <vector>
#include "Payment.h"

struct Expense {
    std::string description;
    float amount;
    bool isPaid;   // true = paid, false = unpaid
    PaymentMode paymentMode; 
};

void loadExpenses(std::vector<Expense>& expenses);
void saveExpenses(const std::vector<Expense>& expenses);
void showExpenses(const std::vector<Expense>& expenses);
void addExpense(std::vector<Expense>& expenses);
void markExpensePaid(std::vector<Expense>& expenses);

#endif
