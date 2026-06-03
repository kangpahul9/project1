export const tools = [
  {
    type: "function",
    function: {
      name: "get_today_sales",
      description: "Get today's total sales",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders_count",
      description: "Get number of orders for today",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_items",
      description: "Get top selling items today",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expenses_summary",
      description: "Get today's total expenses",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_item_sales_range",
      description: "Get number of items sold in a date range",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
        required: ["item", "startDate", "endDate"],
      },
    },
  },
];