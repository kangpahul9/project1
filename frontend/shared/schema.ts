import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === Users (Staff/Admin/Owner) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pin: text("pin").notNull().unique(), // Simple PIN for login
  role: text("role").notNull().default("staff"), // staff, admin, owner
  isActive: boolean("is_active").default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

// === Business Day (Daily Register/Galla) ===
export const businessDays = pgTable("business_days", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(), // YYYY-MM-DD
  openingCash: integer("opening_cash").notNull().default(0),
  closingCash: integer("closing_cash"), // Null until closed
  status: text("status").notNull().default("open"), // open, closed
  openedBy: integer("opened_by").references(() => users.id),
  closedBy: integer("closed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBusinessDaySchema = createInsertSchema(businessDays).omit({ id: true, createdAt: true });

// === Menu ===
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id),
  name: text("name").notNull(),
  price: integer("price").notNull(), // Stored in full currency units (e.g. ₹280) for simplicity as per requirements
  isAvailable: boolean("is_available").default(true),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });

// === Orders ===
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  businessDayId: integer("business_day_id").references(() => businessDays.id),
  userId: integer("user_id").references(() => users.id), // Staff who took order
  customerName: text("customer_name"),
  totalAmount: integer("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, online, card
  status: text("status").notNull().default("completed"), // completed, voided
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  menuItemId: integer("menu_item_id").references(() => menuItems.id),
  name: text("name").notNull(), // Snapshot of name
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(), // Snapshot of price
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

// === Vendors & Expenses ===
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact"),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  businessDayId: integer("business_day_id").references(() => businessDays.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  paymentMode: text("payment_mode").notNull(), // cash, online
  category: text("category").notNull(), // e.g., 'supplies', 'salary', 'utility'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });

// === RELATIONS ===

export const categoryRelations = relations(categories, ({ many }) => ({
  menuItems: many(menuItems),
}));

export const menuItemRelations = relations(menuItems, ({ one }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
}));

export const businessDayRelations = relations(businessDays, ({ one, many }) => ({
  opener: one(users, {
    fields: [businessDays.openedBy],
    references: [users.id],
    relationName: "opener",
  }),
  closer: one(users, {
    fields: [businessDays.closedBy],
    references: [users.id],
    relationName: "closer",
  }),
  orders: many(orders),
  expenses: many(expenses),
}));

export const userRelations = relations(users, ({ many }) => ({
  openedDays: many(businessDays, { relationName: "opener" }),
  closedDays: many(businessDays, { relationName: "closer" }),
  orders: many(orders),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  businessDay: one(businessDays, {
    fields: [orders.businessDayId],
    references: [businessDays.id],
  }),
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const vendorRelations = relations(vendors, ({ many }) => ({
  expenses: many(expenses),
}));

export const expenseRelations = relations(expenses, ({ one }) => ({
  businessDay: one(businessDays, {
    fields: [expenses.businessDayId],
    references: [businessDays.id],
  }),
  vendor: one(vendors, {
    fields: [expenses.vendorId],
    references: [vendors.id],
  }),
}));

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type BusinessDay = typeof businessDays.$inferSelect;
export type InsertBusinessDay = z.infer<typeof insertBusinessDaySchema>;

export type MenuItem = typeof menuItems.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Vendor = typeof vendors.$inferSelect;

// === API Request Types ===
export type CreateOrderRequest = {
  businessDayId: number;
  userId: number;
  customerName?: string;
  paymentMethod: "cash" | "online" | "card";
  items: {
    menuItemId: number;
    quantity: number;
    price: number;
    name: string;
  }[];
};

export type CloseDayRequest = {
  closingCash: number;
  closedBy: number;
};

export type LoginRequest = {
  pin: string;
};
