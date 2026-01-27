#include "PaymentController.h"
#include "../Approval.h"
#include <iomanip>

PaymentResponse processPaymentController(
    std::vector<OrderItem>& order,
    GallaState& galla,
    const PaymentRequest& req
) {
    float total = 0;
    for (const auto& item : order) {
        total += item.total();
    }

    // Assign payment mode to all order items
    for (auto& item : order) {
        item.paymentMode = req.mode;
    }

    // ---- NON CASH ----
    if (req.mode != PaymentMode::CASH) {
        return {
            true,
            "Payment received via non-cash method.",
            total,
            0
        };
    }

    // ---- CASH FLOW ----
    if (req.cashReceived < total) {
        return {
            false,
            "Insufficient cash received.",
            total,
            0
        };
    }

    float change = req.cashReceived - total;

    // Add received cash first
    addToGalla(galla, req.cashReceived);

    // Approval for large change
    if (change > 1000) {
        if (!requestApproval(
                ApprovalType::LARGE_CHANGE,
                change,
                "Large change return"
        )) {
            return {
                false,
                "Change approval denied.",
                total,
                0
            };
        }
    }

    // Deduct change
    if (change > 0 && !deductFromGalla(galla, change)) {
        return {
            false,
            "Cannot return exact change.",
            total,
            0
        };
    }

    return {
        true,
        "Cash payment successful.",
        total,
        change
    };
}
