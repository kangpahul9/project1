#include "WithdrawalController.h"
#include "../Approval.h"
#include "../Utils.h"

WithdrawalResponse withdrawalController(
    std::vector<CashWithdrawal>& withdrawals,
    GallaState& galla,
    const WithdrawalRequest& req
) {
    if (!requestApproval(
            ApprovalType::WITHDRAWAL,
            req.amount,
            "Owner cash withdrawal"
    )) {
        return {false, "Withdrawal not approved."};
    }

    if (!deductFromGalla(galla, req.amount)) {
        return {false, "Insufficient cash in galla."};
    }

    CashWithdrawal w;
    w.id = generateId("WD");
    w.date = req.date;
    w.amount = req.amount;

    withdrawals.push_back(w);
    saveWithdrawals(withdrawals);

    return {true, "Cash withdrawal recorded."};
}
