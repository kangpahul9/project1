#ifndef CASH_FLOW_CONTROLLER_H
#define CASH_FLOW_CONTROLLER_H

struct CashFlowResponse {
    float cashIn;
    float bankIn;
    float withdrawals;
    float cashExpenses;
    float netCash;
};

CashFlowResponse cashFlowController();

#endif
