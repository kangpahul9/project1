#ifndef UTILS_H
#define UTILS_H

#include <string>

// Date helpers
std::string getTodayDate();        // YYYY-MM-DD
std::string getTodayCompact();     // YYYYMMDD

// String helpers
std::string toUpper(const std::string& s);

std::string generateId(const std::string& prefix);

#endif
