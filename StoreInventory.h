#ifndef STORE_INVENTORY_H
#define STORE_INVENTORY_H

#include <string>
#include <vector>

struct StoreItem {
    std::string name;
    float quantity;
    std::string unit;
    float costPerUnit;
};

void loadStoreInventory(std::vector<StoreItem>& store);
void saveStoreInventory(const std::vector<StoreItem>& store);
void showStoreInventory(const std::vector<StoreItem>& store);
void addStoreItem(std::vector<StoreItem>& store);
void updateStoreItemQuantity(std::vector<StoreItem>& store);
void useStoreItem(std::vector<StoreItem>& store);

#endif
