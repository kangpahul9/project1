#ifndef CASH_H
#define CASH_H

#include <string>
#include <vector>

struct CashWithdrawal {
    std::string date;   // YYYY-MM-DD
    float amount;
};

void loadWithdrawals(std::vector<CashWithdrawal>& withdrawals);
void saveWithdrawals(const std::vector<CashWithdrawal>& withdrawals);
void showWithdrawals(const std::vector<CashWithdrawal>& withdrawals);
void addWithdrawal(std::vector<CashWithdrawal>& withdrawals);

#endif
