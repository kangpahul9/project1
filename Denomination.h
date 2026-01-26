#ifndef DENOMINATION_H
#define DENOMINATION_H

#include <vector>
#include <iostream>

struct Denomination {
    int value;    // 10, 20, 50, 100, 200, 500
    int count;
};

float calculateTotal(const std::vector<Denomination>& denoms);
void inputDenominations(std::vector<Denomination>& denoms);
void printDenominations(const std::vector<Denomination>& denoms);

#endif
