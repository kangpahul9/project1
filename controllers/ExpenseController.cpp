#include "ExpenseController.h"
#include "../Approval.h"

PayExpenseResponse payExpenseController(
    std::vector<Expense>& expenses,
    GallaState& galla,
    const PayExpenseRequest& req
) {
    for (auto& e : expenses) {

        if (e.id != req.expenseId)
            continue;

        if (e.isPaid) {
            return {false, "Expense already paid."};
        }

        // ---- CASH FLOW ----
        if (req.mode == PaymentMode::CASH) {

            if (!requestApproval(
                    ApprovalType::CASH_EXPENSE,
                    e.amount,
                    e.description
            )) {
                return {false, "Expense payment not approved."};
            }

            if (!deductFromGalla(galla, e.amount)) {
                return {false, "Insufficient cash in galla."};
            }

            e.paymentMode = PaymentMode::CASH;
        }
        else {
            e.paymentMode = req.mode; // UPI / BANK
        }

        e.isPaid = true;
        saveExpenses(expenses);

        return {true, "Expense marked as PAID."};
    }

    return {false, "Expense not found."};
}
