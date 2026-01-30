#include "WithdrawalController.h"
#include "../Approval.h"
#include "../Utils.h"
#include "../DailyCash.h"   // ✅ REQUIRED

WithdrawalResponse withdrawalController(
    std::vector<CashWithdrawal>& withdrawals,
    GallaState& galla,
    const WithdrawalRequest& req
) {
    // ---- Approval ----
    if (!requestApproval(
            ApprovalType::WITHDRAWAL,
            req.amount,
            "Owner cash withdrawal"
    )) {
        return {false, "Withdrawal not approved."};
    }

    // ---- Cash availability ----
    if (!deductFromGalla(galla, req.amount)) {
        return {false, "Insufficient cash in galla."};
    }

    // ---- Get active business date ----
    std::vector<DailyCash> records;
    loadDailyCash(records);

    if (records.empty() || records.back().isClosed) {
        return {false, "No active business day."};
    }

    // ---- Record withdrawal ----
    CashWithdrawal w;
    w.id = generateId("WD");
    w.date = records.back().date;   // ✅ FIXED
    w.amount = req.amount;

    withdrawals.push_back(w);
    saveWithdrawals(withdrawals);

    return {true, "Cash withdrawal recorded."};
}
