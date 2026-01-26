#ifndef DAILY_CASH_H
#define DAILY_CASH_H

#include <string>
#include <vector>
#include "Denomination.h"
#include"GallaState.h"

struct DailyCash {
    std::string date;

    float openingCash;
    float closingCash;

    std::vector<Denomination> openingDenoms;
    std::vector<Denomination> closingDenoms;

    bool isClosed;
};

void loadDailyCash(std::vector<DailyCash>& records);
void saveDailyCash(const std::vector<DailyCash>& records);

void startDay(std::vector<DailyCash>& records);
void closeDay(std::vector<DailyCash>& records, const GallaState& galla);
void showDailyCash(const std::vector<DailyCash>& records);

#endif
