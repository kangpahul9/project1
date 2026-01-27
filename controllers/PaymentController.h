#ifndef PAYMENT_CONTROLLER_H
#define PAYMENT_CONTROLLER_H

#include <vector>
#include <string>
#include "../Order.h"
#include "../GallaState.h"
#include "../Payment.h"

struct PaymentRequest {
    PaymentMode mode;
    float cashReceived;     // only for CASH, else ignored
};

struct PaymentResponse {
    bool success;
    std::string message;
    float totalAmount;
    float changeReturned;
};

PaymentResponse processPaymentController(
    std::vector<OrderItem>& order,
    GallaState& galla,
    const PaymentRequest& req
);

#endif
