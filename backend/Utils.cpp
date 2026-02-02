#include "Utils.h"
#include <ctime>
#include <algorithm>
#include <sstream>
#include <chrono>

using namespace std;

string getTodayDate() {
    time_t now = time(nullptr);
    tm* t = localtime(&now);

    char buf[11];
    strftime(buf, sizeof(buf), "%Y-%m-%d", t);
    return string(buf);
}

string getTodayCompact() {
    time_t now = time(nullptr);
    tm* t = localtime(&now);

    char buf[9];
    strftime(buf, sizeof(buf), "%Y%m%d", t);
    return string(buf);
}

string toUpper(const string& s) {
    string out = s;
    transform(out.begin(), out.end(), out.begin(), ::toupper);
    return out;
}

std::string generateId(const std::string& prefix) {
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ).count();

    std::stringstream ss;
    ss << prefix << "_" << ms;
    return ss.str();
}