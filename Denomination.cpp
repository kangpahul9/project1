#include "Denomination.h"
#include <iostream>
#include <limits>

float calculateTotal(const std::vector<Denomination>& denoms) {
    float total = 0;
    for (const auto& d : denoms) {
        total += d.value * d.count;
    }
    return total;
}

void inputDenominations(std::vector<Denomination>& denoms) {
    // IMPORTANT: highest to lowest
    int values[] = {500, 200, 100, 50, 20, 10};

    denoms.clear();
    for (int v : values) {
        int c;
        std::cout << "Enter count for ₹" << v << ": ";

        while (!(std::cin >> c) || c < 0) {
            std::cout << "Invalid count. Enter again: ";
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        }

        denoms.push_back({v, c});
    }
}
void printDenominations(const std::vector<Denomination>& denoms) {
    for (const auto& d : denoms) {
        std::cout << "₹" << d.value << " x " << d.count << "\n";
    }
    std::cout << "Total: ₹" << calculateTotal(denoms) << "\n";
}

