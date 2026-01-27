#ifndef EXPENSE_CONTROLLER_H
#define EXPENSE_CONTROLLER_H

#include <string>
#include <vector>
#include "../Expenses.h"
#include "../GallaState.h"
#include "../Payment.h"

struct PayExpenseRequest {
    std::string expenseId;
    PaymentMode mode;
};

struct PayExpenseResponse {
    bool success;
    std::string message;
};

PayExpenseResponse payExpenseController(
    std::vector<Expense>& expenses,
    GallaState& galla,
    const PayExpenseRequest& req
);

#endif
