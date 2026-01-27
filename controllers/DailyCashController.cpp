#include "DailyCashController.h"

StartDayResponse startDayController(
    std::vector<DailyCash>& records,
    const StartDayRequest& req
) {
    // ❌ Prevent starting if previous day not closed
    if (!records.empty() && !records.back().isClosed) {
        return {0, false};
    }

    // ❌ Prevent duplicate date
    for (const auto& r : records) {
        if (r.date == req.date) {
            return {0, false};
        }
    }

    DailyCash d;
    d.date = req.date;
    d.openingDenoms = req.openingDenoms;
    d.openingCash = calculateTotal(req.openingDenoms);
    d.closingCash = 0;
    d.isClosed = false;

    bool mismatch = false;
    if (!records.empty()) {
        const DailyCash& last = records.back();
        if (last.closingCash != d.openingCash) {
            mismatch = true;
        }
    }

    records.push_back(d);
    saveDailyCash(records);

    return { d.openingCash, mismatch };
}

CloseDayResult closeDayController(
    std::vector<DailyCash>& records,
    const GallaState& galla
) {
    if (records.empty()) {
        return {false, "No day started.", 0};
    }

    DailyCash& today = records.back();

    if (today.isClosed) {
        return {false, "Day already closed.", today.closingCash};
    }

    today.closingDenoms = galla.denoms;
    today.closingCash = getGallaTotal(galla);
    today.isClosed = true;

    saveDailyCash(records);

    return {
        true,
        "Day closed successfully.",
        today.closingCash
    };
}