import { z } from 'zod';
import { 
  insertUserSchema, 
  insertBusinessDaySchema, 
  insertMenuItemSchema, 
  insertExpenseSchema, 
  insertVendorSchema,
  users,
  businessDays,
  menuItems,
  categories,
  orders,
  expenses,
  vendors
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  businessRule: z.object({
    message: z.string(),
  })
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({ pin: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  businessDays: {
    getCurrent: {
      method: 'GET' as const,
      path: '/api/business-days/current',
      responses: {
        200: z.custom<typeof businessDays.$inferSelect>(),
        204: z.void(), // No open day
      },
    },
    open: {
      method: 'POST' as const,
      path: '/api/business-days/open',
      input: z.object({
        openingCash: z.coerce.number(),
        openedBy: z.number(),
      }),
      responses: {
        201: z.custom<typeof businessDays.$inferSelect>(),
        400: errorSchemas.businessRule,
      },
    },
    close: {
      method: 'POST' as const,
      path: '/api/business-days/:id/close',
      input: z.object({
        closingCash: z.coerce.number(),
        closedBy: z.number(),
      }),
      responses: {
        200: z.custom<typeof businessDays.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/business-days',
      responses: {
        200: z.array(z.custom<typeof businessDays.$inferSelect>()),
      },
    }
  },
  menu: {
    list: {
      method: 'GET' as const,
      path: '/api/menu',
      responses: {
        200: z.array(z.custom<typeof menuItems.$inferSelect & { category: typeof categories.$inferSelect | null }>()),
      },
    },
    categories: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    }
  },
  orders: {
    create: {
      method: 'POST' as const,
      path: '/api/orders',
      input: z.object({
        businessDayId: z.number(),
        userId: z.number(),
        customerName: z.string().optional(),
        paymentMethod: z.enum(["cash", "online", "card"]),
        items: z.array(z.object({
          menuItemId: z.number(),
          quantity: z.number(),
          price: z.number(),
          name: z.string(),
        })),
      }),
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.businessRule,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      input: z.object({
        businessDayId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    }
  },
  expenses: {
    create: {
      method: 'POST' as const,
      path: '/api/expenses',
      input: insertExpenseSchema,
      responses: {
        201: z.custom<typeof expenses.$inferSelect>(),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/expenses',
      responses: {
        200: z.array(z.custom<typeof expenses.$inferSelect & { vendor: typeof vendors.$inferSelect | null }>()),
      },
    }
  },
  vendors: {
    list: {
      method: 'GET' as const,
      path: '/api/vendors',
      responses: {
        200: z.array(z.custom<typeof vendors.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vendors',
      input: insertVendorSchema,
      responses: {
        201: z.custom<typeof vendors.$inferSelect>(),
      },
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
