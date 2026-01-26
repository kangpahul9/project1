#ifndef PAYMENT_H
#define PAYMENT_H

#include <string>

enum class PaymentMode {
    CASH = 1,
    UPI,
    CARD,
    ONLINE
};

inline std::string paymentModeToString(PaymentMode mode) {
    switch (mode) {
        case PaymentMode::CASH: return "CASH";
        case PaymentMode::UPI: return "UPI";
        case PaymentMode::CARD: return "CARD";
        case PaymentMode::ONLINE: return "ONLINE";
        default: return "UNKNOWN";
    }
}

#endif
