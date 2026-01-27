#ifndef DAILY_CASH_CONTROLLER_H
#define DAILY_CASH_CONTROLLER_H

#include <string>
#include <vector>
#include "../DailyCash.h"
#include "../GallaState.h"
#include "../Denomination.h"

struct StartDayRequest {
    std::string date;
    std::vector<Denomination> openingDenoms;
};

struct StartDayResponse {
    float openingCash;
    bool mismatchWarning;
};

StartDayResponse startDayController(
    std::vector<DailyCash>& records,
    const StartDayRequest& req
);


struct CloseDayResult {
    bool success;
    std::string message;
    float closingCash;
};

CloseDayResult closeDayController(
    std::vector<DailyCash>& records,
    const GallaState& galla
);
#endif
