#ifndef CASH_H
#define CASH_H

#include <string>
#include <vector>
#include "Utils.h"
#include"Approval.h"
#include"GallaState.h"

struct CashWithdrawal {
    std::string id;
    std::string date;   // YYYY-MM-DD
    float amount;
};

void loadWithdrawals(std::vector<CashWithdrawal>& withdrawals);
void saveWithdrawals(const std::vector<CashWithdrawal>& withdrawals);
void showWithdrawals(const std::vector<CashWithdrawal>& withdrawals);
void addWithdrawal(std::vector<CashWithdrawal>& withdrawals);

#endif
