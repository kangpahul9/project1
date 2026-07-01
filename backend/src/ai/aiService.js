import openai from "./openaiClient.js";
import pool from "../config/db.js";

/* =========================================
   TOOL DEFINITIONS (OpenAI function format)
========================================= */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_today_sales",
      description: "Get today's total sales, order count, and cash/online split",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_item_sales",
      description: "Get how many of a specific item were sold, optionally between dates",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string", description: "Item name (partial match OK)" },
          startDate: { type: "string", description: "Start date YYYY-MM-DD (optional, defaults to 30 days ago)" },
          endDate: { type: "string", description: "End date YYYY-MM-DD (optional, defaults to today)" },
        },
        required: ["item"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_items",
      description: "Get top selling items by quantity for a given period",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days to look back (default 7)" },
          limit: { type: "number", description: "How many items to return (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders",
      description: "Search or list recent orders — filter by date, customer name, bill number, or payment method",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          billNumber: { type: "string" },
          customerName: { type: "string" },
          paymentMethod: { type: "string" },
          limit: { type: "number", description: "Max orders to return (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expenses_summary",
      description: "Get total expenses for a period",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Days to look back (default 7)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_order",
      description: "Soft-delete an order by bill number. Triggers a full refund. Use only when the owner explicitly asks.",
      parameters: {
        type: "object",
        properties: {
          billNumber: { type: "string", description: "The bill number to delete" },
        },
        required: ["billNumber"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "Get a sales summary between two dates — total revenue, orders, cash, online",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
];

/* =========================================
   TOOL EXECUTORS
========================================= */
async function runTool(name, input, restaurantId, userId) {
  switch (name) {
    case "get_today_sales": {
      const res = await pool.query(
        `SELECT
          COALESCE(SUM(total),0) AS total_sales,
          COUNT(*) AS total_orders,
          COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash_sales,
          COALESCE(SUM(CASE WHEN payment_method IN ('online','card') THEN total ELSE 0 END),0) AS online_sales
        FROM orders
        WHERE restaurant_id=$1 AND DATE(created_at)=CURRENT_DATE AND is_deleted=FALSE`,
        [restaurantId]
      );
      return res.rows[0];
    }

    case "get_item_sales": {
      const { item, startDate, endDate } = input;
      const res = await pool.query(
        `SELECT
          oi.item_name,
          SUM(oi.quantity) AS total_sold,
          SUM(oi.quantity * COALESCE(oi.price_snapshot, oi.price)) AS total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id=$1
          AND LOWER(oi.item_name) LIKE LOWER($2)
          AND o.is_deleted=FALSE
          AND o.created_at >= $3
          AND o.created_at <= $4
        GROUP BY oi.item_name
        ORDER BY total_sold DESC`,
        [
          restaurantId,
          `%${item}%`,
          startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          endDate || new Date().toISOString().slice(0, 10),
        ]
      );
      return { results: res.rows, period: { startDate, endDate } };
    }

    case "get_top_items": {
      const days = Math.min(Math.max(1, Number(input.days) || 7), 365);
      const limit = Math.min(Math.max(1, Number(input.limit) || 10), 100);
      const res = await pool.query(
        `SELECT
          oi.item_name,
          SUM(oi.quantity) AS total_sold,
          SUM(oi.quantity * COALESCE(oi.price_snapshot, oi.price)) AS total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id=$1
          AND o.is_deleted=FALSE
          AND o.created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY oi.item_name
        ORDER BY total_sold DESC
        LIMIT $3`,
        [restaurantId, days, limit]
      );
      return { topItems: res.rows, days };
    }

    case "get_orders": {
      const { date, billNumber, customerName, paymentMethod, limit = 10 } = input;
      const conditions = [`o.restaurant_id=$1`, `o.is_deleted=FALSE`];
      const params = [restaurantId];
      let i = 2;

      if (date) { conditions.push(`DATE(o.created_at)=$${i++}`); params.push(date); }
      if (billNumber) { conditions.push(`o.bill_number ILIKE $${i++}`); params.push(`%${billNumber}%`); }
      if (customerName) { conditions.push(`o.customer_name ILIKE $${i++}`); params.push(`%${customerName}%`); }
      if (paymentMethod) { conditions.push(`o.payment_method=$${i++}`); params.push(paymentMethod); }

      params.push(limit);

      const res = await pool.query(
        `SELECT bill_number, customer_name, payment_method, total, is_paid, created_at
        FROM orders o
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${i}`,
        params
      );
      return { orders: res.rows };
    }

    case "get_expenses_summary": {
      const days = Math.min(Math.max(1, Number(input.days) || 7), 365);
      const res = await pool.query(
        `SELECT
          category,
          COALESCE(SUM(amount),0) AS category_total,
          COUNT(*) AS expense_count
        FROM expenses
        WHERE restaurant_id=$1
          AND created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY category
        ORDER BY category_total DESC`,
        [restaurantId, days]
      );
      const total = res.rows.reduce((s, r) => s + Number(r.category_total), 0);
      return { total, byCategory: res.rows, days };
    }

    case "delete_order": {
      const { billNumber } = input;
      const orderRes = await pool.query(
        `SELECT id, total, is_deleted FROM orders WHERE restaurant_id=$1 AND bill_number=$2`,
        [restaurantId, billNumber]
      );
      if (!orderRes.rows.length) {
        return { success: false, error: `Order ${billNumber} not found` };
      }
      if (orderRes.rows[0].is_deleted) {
        return { success: false, error: `Order ${billNumber} is already deleted` };
      }

      const orderId = orderRes.rows[0].id;
      const idempotencyKey = `ai_delete_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      if (!process.env.AI_INTERNAL_SECRET) {
        return { success: false, error: "AI_INTERNAL_SECRET not configured" };
      }

      const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/orders/${orderId}/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Internal": process.env.AI_INTERNAL_SECRET,
        },
        body: JSON.stringify({ idempotencyKey }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.message || "Delete failed" };
      }

      return { success: true, message: `Order ${billNumber} deleted and refunded` };
    }

    case "get_sales_summary": {
      const { startDate, endDate } = input;
      const res = await pool.query(
        `SELECT
          COALESCE(SUM(total),0) AS total_sales,
          COUNT(*) AS total_orders,
          COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash,
          COALESCE(SUM(CASE WHEN payment_method IN ('online','card') THEN total ELSE 0 END),0) AS online
        FROM orders
        WHERE restaurant_id=$1
          AND is_deleted=FALSE
          AND created_at >= $2
          AND created_at < ($3::date + INTERVAL '1 day')`,
        [restaurantId, startDate, endDate]
      );
      return { ...res.rows[0], period: { startDate, endDate } };
    }

    default:
      return { error: "Unknown tool" };
  }
}

/* =========================================
   MAIN AI QUERY HANDLER
========================================= */
export async function handleAIQuery({ question, restaurantId, userId }) {
  if (!question || question.length > 500) {
    return { answer: "Please ask a shorter question (max 500 characters)." };
  }

  const systemPrompt = `You are KangPOS Assistant — the built-in AI for KangPOS business management software.

You help with TWO types of questions:
1. BUSINESS DATA — use tools to answer questions about this business's sales, orders, expenses, etc.
2. HOW-TO / FAQ — answer from your KangPOS product knowledge below.

## KangPOS Product Knowledge

### Orders & POS
- Two order modes: "Tables" (seated/dine-in) and "Order" (walk-up/takeaway). Toggle in the POS screen top bar.
- Customer name and phone are required for Order (walk-up) mode.
- Add items to cart → choose payment method (Cash, Card, Online, Credit). "Credit" = customer owes, creates an unpaid order.
- Split bills, apply discounts, issue refunds all from the POS screen.
- Unpaid orders appear in the Unpaid Orders section and can be paid off later.

### Cash Management
- Denomination-based till tracking — counts exact notes and coins.
- Open business day: enter opening float by denomination.
- Withdraw Cash: remove cash with a reason (e.g. supplier payment, petty cash). Attributes to a partner if needed.
- Add Cash: deposit into drawer.
- Close business day: count closing float → KangPOS calculates expected amount and flags discrepancies. A reason is required if there's a mismatch.
- Recount Cash: re-verify drawer balance mid-day without closing.

### Business Days
- Business Day mode groups all orders under one "day" regardless of clock time — useful for venues that trade past midnight.
- Without Business Day mode, reports use calendar date.
- Only one business day can be open at a time. Open it from the Dashboard.

### Staff & Payroll
- Add staff under the Staff section. Assign a pay type (hourly rate, salary, casual, etc.).
- Payroll calculates: actual hours worked × base rate. Supports weekday/weekend rates.
- Salary advances can be recorded and are automatically deducted from the next payroll run.
- Xero integration: push approved payroll batches directly to Xero — no manual data entry.

### Roster & Scheduling
- Build weekly rosters: create shifts, set start/end times, assign staff members.
- Staff see their upcoming shifts on their Dashboard.
- Clock in/out is tied to scheduled shifts. Actual hours sync to payroll automatically.
- Copy last week's roster to speed up scheduling.

### Reports
- Daily Report: today's sales, cash vs card split, unpaid orders, growth vs yesterday.
- Weekly / Monthly Reports: trend charts, day-by-day breakdown, exportable CSV.
- Top Items: best sellers by quantity and revenue for any date range.
- Item Search: full performance breakdown for any single menu item.
- Hourly Pattern: find peak and quiet trading hours.
- Staff Attendance: clock-in/out logs with actual hours worked, filterable by date range.
- Payroll Summary: estimated labour costs per staff member for any period.
- Cash Flow: withdrawals vs deposits side-by-side with net total.

### Menu Management
- Add/edit items with name, price, category, image, and barcode.
- Create categories to organise the POS screen.
- Combos: bundle multiple items at a special combined price.
- Barcodes can be scanned at the POS or printed for labelling.

### Settings
- System Settings: business name, currency (AUD default), business day mode toggle, cash recount toggle.
- Payment Settings: EFTPOS provider (e.g. Tyro), UPI ID, PayID details.
- Communication Settings: WhatsApp notifications for new orders and bill delivery.
- Payroll Settings: enable payroll module, link Xero account.

### Partners
- Partners are profit-sharing stakeholders (e.g. co-owners, investors).
- Cash withdrawals and deposits can be attributed to specific partners.
- Each partner has a ledger showing their running balance.

### Expenses & Vendors
- Log expenses with amount, category, payment method, and optional receipt image.
- Link to a vendor for organised tracking.
- Some categories (e.g. supplier payments) can auto-deduct from the cash drawer.

### AI Assistant
- I can answer questions about your live business data AND explain how KangPOS features work.
- Try: "What were my top items this week?", "How do I set up payroll?", "Show me today's sales."

## Rules
- For DATA questions: always use tools to get real numbers — never guess or make up figures.
- For HOW-TO questions: answer clearly and concisely from the knowledge above.
- Never expose data from other businesses.
- Keep answers short and practical — bullet points over paragraphs.
- Format all currency values clearly (e.g. $1,234.50).
- For delete/modify actions: always state exactly what was done.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages,
    tools: TOOLS,
    tool_choice: "auto",
  });

  const assistantMessage = response.choices[0].message;

  if (assistantMessage.tool_calls?.length) {
    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (tc) => {
        const input = JSON.parse(tc.function.arguments);
        const result = await runTool(tc.function.name, input, restaurantId, userId);
        return { tool_call_id: tc.id, result };
      })
    );

    // Build follow-up messages with tool results
    const followUpMessages = [
      ...messages,
      assistantMessage,
      ...toolResults.map((r) => ({
        role: "tool",
        tool_call_id: r.tool_call_id,
        content: JSON.stringify(r.result),
      })),
    ];

    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: followUpMessages,
      tools: TOOLS,
      tool_choice: "none",
    });

    return { answer: finalResponse.choices[0].message.content || "Done." };
  }

  return { answer: assistantMessage.content || "I'm here to help with your business data and KangPOS features. What would you like to know?" };
}
