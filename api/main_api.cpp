#include "crow_all.h"


#include "../Approval.h"
#include "../Auth.h"
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

#include "../controllers/CashFlowController.h"
#include "../controllers/DailyCashController.h"
#include "../controllers/DailySalesController.h"
#include "../controllers/ExpenseController.h"
#include "../controllers/PaymentController.h"
#include "../controllers/WithdrawalController.h"

#include <iostream>
#include <vector>

std::vector<OrderItem> activeOrder;
GallaState galla;
// ---- TEMP ADMIN CHECK (Phase 9 → JWT / OTP) ----
bool isAdminRequest(const crow::request& req) {
    auto role = req.get_header_value("X-ROLE");
    return role == "ADMIN";
}

int main() {
    crow::SimpleApp app;

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
    ([](const crow::request& req) {

        if (!isAdminRequest(req)) {
            return crow::response(403, "Admin access required");
        }

        auto body = crow::json::load(req.body);
        if (!body) {
            return crow::response(400, "Invalid JSON");
        }

        if (!body.has("name") || !body.has("price")) {
            return crow::response(400, "Missing fields");
        }

        std::vector<MenuItem> menu;
        loadMenu(menu);

        MenuItem item;
        item.name = body["name"].s();
        item.price = body["price"].d();

        menu.push_back(item);
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


    // ===============================
    // Server start
    // ===============================

    std::cout << "🚀 POS API server running on http://localhost:8080\n";

    app.port(8080)
       .multithreaded()
       .run();

    return 0;
}
