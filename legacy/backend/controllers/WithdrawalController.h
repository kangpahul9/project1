#ifndef WITHDRAWAL_CONTROLLER_H
#define WITHDRAWAL_CONTROLLER_H

#include <vector>
#include <string>
#include "../Cash.h"
#include "../GallaState.h"

struct WithdrawalRequest {
    std::string date;
    float amount;
};

struct WithdrawalResponse {
    bool success;
    std::string message;
};

WithdrawalResponse withdrawalController(
    std::vector<CashWithdrawal>& withdrawals,
    GallaState& galla,
    const WithdrawalRequest& req
);

#endif
