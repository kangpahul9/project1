#ifndef MENU_H
#define MENU_H
#include <string>
#include <vector>

struct MenuItem {
    std::string name;
    float price;
};
void loadMenu(std::vector<MenuItem>& Menu);
void saveMenu(const std::vector<MenuItem>& Menu);
void showMenu(const std::vector<MenuItem>& Menu);
void addMenuItem(std::vector<MenuItem>& Menu);
void editMenuItemPrice(std::vector<MenuItem>& menu);


#endif 