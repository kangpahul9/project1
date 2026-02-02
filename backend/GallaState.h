#ifndef GALLA_STATE_H
#define GALLA_STATE_H

#include "Denomination.h"
#include <vector>

struct GallaState {
    std::vector<Denomination> denoms;
};

float getGallaTotal(const GallaState& galla);
bool deductFromGalla(GallaState& galla, float amount);
void addToGalla(GallaState& galla, float amount);

#endif