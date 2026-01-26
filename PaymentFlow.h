#ifndef PAYMENT_FLOW_H
#define PAYMENT_FLOW_H

#include "Order.h"
#include "GallaState.h"
#include "Payment.h"

bool processPayment(
    const std::vector<OrderItem>& order,
    GallaState& galla
);

#endif