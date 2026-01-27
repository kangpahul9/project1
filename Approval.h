#ifndef APPROVAL_H
#define APPROVAL_H

#include <string>

enum class ApprovalType {
    CASH_EXPENSE,
    WITHDRAWAL,
    SALARY,
    LARGE_CHANGE
};

bool requestApproval(
    ApprovalType type,
    float amount,
    const std::string& reason
);

#endif
