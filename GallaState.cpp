#include "GallaState.h"
#include <iostream>

using namespace std;

float getGallaTotal(const GallaState& galla) {
    float total = 0;
    for (const auto& d : galla.denoms) {
        total += d.value * d.count;
    }
    return total;
}

// Adds cash into galla (sales, cash inflow)
void addToGalla(GallaState& galla, float amount) {
    int remaining = static_cast<int>(amount);

    // Add using highest denomination first
    for (auto& d : galla.denoms) {
        int add = remaining / d.value;
        if (add > 0) {
            d.count += add;
            remaining -= add * d.value;
        }
    }

    if (remaining > 0) {
        cout << "⚠️ Warning: Small change remainder ₹" 
             << remaining << " not allocated.\n";
    }
}

// Deduct cash from galla (expenses, withdrawals, change)
bool deductFromGalla(GallaState& galla, float amount) {
    if (getGallaTotal(galla) < amount) {
        cout << "❌ Not enough cash in galla.\n";
        return false;
    }

    int remaining = static_cast<int>(amount);

    // Deduct using highest denomination first
    for (auto& d : galla.denoms) {
        while (d.count > 0 && remaining >= d.value) {
            d.count--;
            remaining -= d.value;
        }
    }

    if (remaining > 0) {
        cout << "❌ Exact change not possible.\n";
        return false;
    }

    return true;
}
