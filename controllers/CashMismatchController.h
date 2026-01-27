#ifndef CASH_MISMATCH_CONTROLLER_H
#define CASH_MISMATCH_CONTROLLER_H

#include <string>

struct CashMismatchResponse {
    std::string date;
    float openingCash;
    float expectedCash;
    float closingCash;
    float difference;
};

CashMismatchResponse cashMismatchController();

#endif
