#include "crow_all.h"


#include "../Approval.h"
#include "../AuthUser.h"
#include "../AuthService.h"
#include "../AuthStore.h"
#include "../Bills.h"
#include "../Cash.h"
#include "../DailyCash.h"
#include "../Denomination.h"
#include "../Expenses.h"
#include "../GallaState.h"
#include "../Menu.h"
#include "../Order.h"
#include "../Payment.h"
#include "../PaymentFlow.h"
#include "../Reports.h"
#include "../Staff.h"
#include "../StoreInventory.h"
#include "../Utils.h"
#include "../Vendors.h"

#include "../auth/AuthController.h"
#include "../auth/JwtMiddleware.h"
#include "../auth/Jwt.h"

#include "../controllers/CashFlowController.h"
#include "../controllers/CashMismatchController.h"
#include "../controllers/DailyCashController.h"
#include "../controllers/DailySalesController.h"
#include "../controllers/ExpenseController.h"
#include "../controllers/PaymentController.h"
#include "../controllers/WithdrawalController.h"

#include <iostream>
#include <vector>

std::vector<OrderItem> activeOrder;
GallaState galla;
std::vector<DailyCash> dailyCash;
std::vector<User> users;
std::vector<CashWithdrawal> withdrawals; 

// ---- TEMP ADMIN CHECK (Phase 9 → JWT / OTP) ----


int main() {
    crow::SimpleApp app;
    loadDailyCash(dailyCash);
    loadUsers(users);
    loadWithdrawals(withdrawals); 

    // ===============================
    // Health & Meta
    // ===============================

    CROW_ROUTE(app, "/health")
    ([] {
        return crow::response{
            200,
            "POS API is running ✅"
        };
    });

    CROW_ROUTE(app, "/version")
    ([] {
        crow::json::wvalue res;
        res["name"] = "Restaurant POS API";
        res["version"] = "8.2.0";
        res["status"] = "stable";
        return res;
    });

    // ===============================
    // MENU APIs
    // ===============================

    // GET /menu  → anyone
    CROW_ROUTE(app, "/menu")
.methods(crow::HTTPMethod::GET)
([] {
    std::vector<MenuItem> menu;
    loadMenu(menu);
    crow::json::wvalue res = crow::json::wvalue::list();

    size_t i = 0;
    for (const auto& item : menu) {
        res[i]["name"]  = item.name;
        res[i]["price"] = item.price;
        i++;
    }

    return res;
});

    // POST /menu  → ADMIN only
CROW_ROUTE(app, "/menu")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    AuthContext ctx;
    crow::response authRes;

    if (!requireAdmin(req, ctx, authRes)) {
        return authRes;
    }

    auto body = crow::json::load(req.body);
    if (!body || !body.has("name") || !body.has("price")) {
        return crow::response(400, "Invalid payload");
    }

    std::vector<MenuItem> menu;
    loadMenu(menu);

    menu.push_back({
    body["name"].s(),
    static_cast<float>(body["price"].d())
});
    saveMenu(menu);

    return crow::response(201, "Menu item added");
});


    CROW_ROUTE(app, "/order/add")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    auto body = crow::json::load(req.body);
    if (!body || !body.has("name") || !body.has("qty")) {
        return crow::response(400, "Invalid payload");
    }

    std::string name = body["name"].s();
    int qty = body["qty"].i();

    if (qty <= 0) {
        return crow::response(400, "Invalid quantity");
    }

    std::vector<MenuItem> menu;
    loadMenu(menu);

    for (const auto& m : menu) {
        if (m.name == name) {

            // merge if exists
            for (auto& o : activeOrder) {
                if (o.name == name) {
                    o.quantity += qty;
                    return crow::response(200, "Quantity updated");
                }
            }

            activeOrder.push_back({
                generateId("ORD"),
                m.name,
                m.price,
                qty,
                PaymentMode::CASH
            });

            return crow::response(201, "Item added to order");
        }
    }

    return crow::response(404, "Menu item not found");
});


CROW_ROUTE(app, "/order")
.methods(crow::HTTPMethod::GET)
([] {

    crow::json::wvalue items = crow::json::wvalue::list();

    float total = 0;
    size_t i = 0;

    for (const auto& o : activeOrder) {
        items[i]["name"]  = o.name;
        items[i]["qty"]   = o.quantity;
        items[i]["price"] = o.price;
        items[i]["total"] = o.total();
        total += o.total();
        i++;
    }

    crow::json::wvalue out;
    out["items"] = std::move(items);
    out["grandTotal"] = total;

    return crow::response{out};   // ✅ CONSISTENT
});


CROW_ROUTE(app, "/order/checkout")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    if (activeOrder.empty()) {
        return crow::response(400, "Order is empty");
    }

    auto body = crow::json::load(req.body);
    if (!body || !body.has("mode")) {
        return crow::response(400, "Invalid payment request");
    }

    PaymentRequest payReq;
    payReq.mode = static_cast<PaymentMode>(body["mode"].i());
    payReq.cashReceived = body.has("cash") ? body["cash"].d() : 0;

    auto result = processPaymentController(activeOrder, galla, payReq);

    if (!result.success) {
        return crow::response(400, result.message);
    }

    logOrder(activeOrder);
    activeOrder.clear();

    crow::json::wvalue res;
    res["message"] = result.message;
    res["total"] = result.totalAmount;
    res["change"] = result.changeReturned;

return crow::response{res};
});

CROW_ROUTE(app, "/bills")
.methods(crow::HTTPMethod::GET)
([] {
    std::vector<Bill> bills;
    loadBills(bills);

    crow::json::wvalue res = crow::json::wvalue::list();
    size_t i = 0;

    for (const auto& b : bills) {
        res[i]["id"] = b.id;
        res[i]["vendor"] = b.vendor;
        res[i]["amount"] = b.amount;
        res[i]["paid"] = b.isPaid;
        res[i]["file"] = b.filePath;
        i++;
    }
    return res;
});


CROW_ROUTE(app, "/bills")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

   AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}
    auto body = crow::json::load(req.body);
    if (!body || !body.has("vendor") || !body.has("amount"))
        return crow::response(400, "Invalid payload");

    std::vector<Bill> bills;
    loadBills(bills);

    Bill b;
    b.id = generateId("BILL");
    b.vendor = body["vendor"].s();
    b.amount = body["amount"].d();
b.filePath = body.has("file")
    ? std::string(body["file"].s())
    : std::string("");    b.isPaid = false;

    bills.push_back(b);
    saveBills(bills);

    return crow::response(201, "Bill added");
});


CROW_ROUTE(app, "/bills/pay")
.methods(crow::HTTPMethod::POST)
([](const crow::request& req) {

    auto body = crow::json::load(req.body);
    if (!body || !body.has("id"))
        return crow::response(400, "Missing bill id");

    std::vector<Bill> bills;
    loadBills(bills);

    for (auto& b : bills) {
        if (b.id == body["id"].s()) {
            b.isPaid = true;
            saveBills(bills);
            return crow::response(200, "Bill marked paid");
        }
    }

    return crow::response(404, "Bill not found");
});


CROW_ROUTE(app, "/expenses")
.methods(crow::HTTPMethod::GET)
([] {
    std::vector<Expense> expenses;
    loadExpenses(expenses);

    crow::json::wvalue res = crow::json::wvalue::list();
    size_t i = 0;

    for (const auto& e : expenses) {
        res[i]["id"] = e.id;
        res[i]["desc"] = e.description;
        res[i]["amount"] = e.amount;
        res[i]["paid"] = e.isPaid;
        res[i]["mode"] = paymentModeToString(e.paymentMode);
        i++;
    }
    return res;
});


CROW_ROUTE(app, "/expenses/pay")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    auto body = crow::json::load(req.body);
    if (!body || !body.has("id") || !body.has("mode"))
        return crow::response(400, "Invalid payload");

    std::vector<Expense> expenses;
    loadExpenses(expenses);

    PayExpenseRequest r;
    r.expenseId = body["id"].s();
    r.mode = static_cast<PaymentMode>(body["mode"].i());

    auto result = payExpenseController(expenses, galla, r);
    if (!result.success)
        return crow::response(400, result.message);

    return crow::response(200, result.message);
});


CROW_ROUTE(app, "/cash/start")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {
    
    auto body = crow::json::load(req.body);
    if (!body || !body.has("date") || !body.has("denoms"))
        return crow::response(400, "Invalid payload");

    StartDayRequest r;
    r.date = body["date"].s();

    for (auto& d : body["denoms"]) {
    r.openingDenoms.push_back({
        static_cast<int>(d["value"].i()),
        static_cast<int>(d["count"].i())
    });
}

    auto res = startDayController(dailyCash, r);
    galla.denoms = r.openingDenoms;


    crow::json::wvalue out;
    out["openingCash"] = res.openingCash;
    out["mismatch"] = res.mismatchWarning;
    return crow::response{out};
});


CROW_ROUTE(app, "/cash/close")
.methods(crow::HTTPMethod::POST)
([&] {
    auto r = closeDayController(dailyCash, galla);

    crow::json::wvalue res;
    res["success"] = r.success;
    res["message"] = r.message;
    res["closingCash"] = r.closingCash;
    return res;
});


CROW_ROUTE(app, "/cash/status")
.methods(crow::HTTPMethod::GET)
([] {
    std::vector<DailyCash> dc;
    loadDailyCash(dc);

    if (dc.empty()) return crow::json::wvalue{};

    auto& d = dc.back();

    crow::json::wvalue res;
    res["date"] = d.date;
    res["opening"] = d.openingCash;
    res["closing"] = d.closingCash;
    res["closed"] = d.isClosed;
    return res;
});


CROW_ROUTE(app, "/withdraw")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    AuthContext ctx;
    crow::response authRes;

    if (!requireAdmin(req, ctx, authRes)) {
        return authRes;
    }

    auto body = crow::json::load(req.body);
    if (!body || !body.has("amount")) {
        return crow::response(400, "Invalid payload");
    }

    WithdrawalRequest r;
    r.amount = body["amount"].d();

    auto result = withdrawalController(withdrawals, galla, r);

    if (!result.success) {
        return crow::response(400, result.message);
    }

    return crow::response(200, result.message);
});


// ===============================

CROW_ROUTE(app, "/staff")
.methods(crow::HTTPMethod::GET)
([&](const crow::request& req) {

    AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}

    std::vector<Staff> staff;
    loadStaff(staff);

    crow::json::wvalue res = crow::json::wvalue::list();
    size_t i = 0;

    for (const auto& s : staff) {
        res[i]["name"] = s.name;
        res[i]["role"] = s.role;
        res[i]["salary"] = s.salary;
        i++;
    }
    return crow::response{res};
});


CROW_ROUTE(app, "/staff")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}
    auto body = crow::json::load(req.body);
    if (!body || !body.has("name") || !body.has("role") || !body.has("salary"))
        return crow::response(400, "Invalid payload");

    std::vector<Staff> staff;
    loadStaff(staff);

    Staff s;
    s.name = body["name"].s();
    s.role = body["role"].s();
    s.salary = body["salary"].d();

    staff.push_back(s);
    saveStaff(staff);

    return crow::response(201, "Staff added");
});

CROW_ROUTE(app, "/staff/pay")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}

    auto body = crow::json::load(req.body);
    if (!body || !body.has("name"))
        return crow::response(400, "Missing staff name");

    std::vector<Staff> staff;
    loadStaff(staff);

    for (const auto& s : staff) {
        if (s.name == body["name"].s()) {

            if (!requestApproval(
                ApprovalType::SALARY,
                s.salary,
                "Salary payout: " + s.name
            )) {
                return crow::response(403, "Salary not approved");
            }

            if (!deductFromGalla(galla, s.salary)) {
                return crow::response(400, "Insufficient galla cash");
            }

            return crow::response(200, "Salary paid");
        }
    }

    return crow::response(404, "Staff not found");
});


CROW_ROUTE(app, "/vendors")
.methods(crow::HTTPMethod::GET)
([] {
    std::vector<Vendor> vendors;
    loadVendors(vendors);

    crow::json::wvalue res = crow::json::wvalue::list();
    size_t i = 0;

    for (const auto& v : vendors) {
        res[i]["name"] = v.name;
        i++;
    }
    return crow::response{res};
});

CROW_ROUTE(app, "/vendors")
.methods(crow::HTTPMethod::POST)
([&](const crow::request& req) {

    AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}
    auto body = crow::json::load(req.body);
    if (!body || !body.has("name"))
        return crow::response(400, "Missing vendor name");

    std::vector<Vendor> vendors;
    loadVendors(vendors);

    Vendor v;
    v.name = body["name"].s();

    vendors.push_back(v);
    saveVendors(vendors);

    return crow::response(201, "Vendor added");
});

CROW_ROUTE(app, "/order/clear")
.methods(crow::HTTPMethod::POST, crow::HTTPMethod::OPTIONS)
([](const crow::request& req) {

    // Handle CORS preflight
    if (req.method == crow::HTTPMethod::OPTIONS) {
        crow::response res;
        res.add_header("Access-Control-Allow-Origin", "*");
        res.add_header("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type, X-ROLE");
        return res;
    }

    activeOrder.clear();
    return crow::response(200, "Order cleared");
});

CROW_ROUTE(app, "/payment/modes")
.methods(crow::HTTPMethod::GET)
([] {
    crow::json::wvalue res;
    res["modes"] = {"CASH", "UPI", "BANK"};
    return res;
});


CROW_ROUTE(app, "/reports/daily-sales")
.methods(crow::HTTPMethod::GET)
([] {

    auto res = dailySalesController();

    crow::json::wvalue out;
    out["orders"] = res.orders;
    out["revenue"] = res.revenue;
    out["bestSeller"] = res.bestSeller;
    out["bestSellerQty"] = res.bestSellerQty;

    return crow::response{out};
});


CROW_ROUTE(app, "/reports/cash-flow")
.methods(crow::HTTPMethod::GET)
([&](const crow::request& req) {

    AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}
    auto r = cashFlowController();

    crow::json::wvalue out;
    out["cashIn"]       = r.cashIn;
    out["bankIn"]       = r.bankIn;
    out["withdrawals"]  = r.withdrawals;
    out["cashExpenses"] = r.cashExpenses;
    out["netCash"]      = r.netCash;

    return crow::response{out};
});

CROW_ROUTE(app, "/reports/cash-mismatch")
.methods(crow::HTTPMethod::GET)
([&](const crow::request& req) {

    AuthContext ctx;
crow::response authRes;

if (!requireAdmin(req, ctx, authRes)) {
    return authRes;
}
    auto r = cashMismatchController();

    // No closed day yet
    if (r.date.empty()) {
        return crow::response(204);
    }

    crow::json::wvalue out;
    out["date"]         = r.date;
    out["openingCash"]  = r.openingCash;
    out["expectedCash"] = r.expectedCash;
    out["closingCash"]  = r.closingCash;
    out["difference"]   = r.difference;

    out["status"] = (r.difference == 0)
        ? "MATCHED"
        : (r.difference > 0 ? "EXCESS" : "SHORTAGE");

    return crow::response{out};
});

CROW_ROUTE(app, "/auth/login")
.methods(crow::HTTPMethod::POST)
([](const crow::request& req) {

    auto body = crow::json::load(req.body);
    if (!body || !body.has("pin")) {
        return crow::response(400, "PIN required");
    }

    auto result = loginController(body["pin"].s());

    if (!result.success) {
        return crow::response(401, result.message);
    }

    crow::json::wvalue res;
    res["userId"] = result.user.id;
    res["name"]   = result.user.name;
    res["role"]   = roleToString(result.user.role);
    res["token"]  = generateJwt(
        result.user.id,
        roleToString(result.user.role)
    );

    return crow::response{res};
});

    // ===============================
    // Server start
    // ===============================

    std::cout << "🚀 POS API server running on http://localhost:8080\n";

    app.port(8080)
       .run();

    return 0;
}
