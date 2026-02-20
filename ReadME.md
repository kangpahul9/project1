POS SYSTEM – FULL STACK RESTAURANT MANAGEMENT

Overview
--------
This is a full-stack Restaurant POS (Point of Sale) system built with:

Frontend:
- React (Vite)
- TypeScript
- Tailwind CSS
- React Query

Backend:
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication

The system manages business days, orders, payments, unpaid credits, drawer cash, withdrawals, and detailed reporting.

------------------------------------------------------------

FEATURES
--------

1. Business Day Management
   - Open business day with denomination-based opening cash
   - Close business day with physical cash counting
   - Drawer cash tracking in real time

2. Order Management
   - Create orders (Cash / Card / Online / Credit)
   - Auto bill number generation
   - Partial payments supported
   - Pay existing unpaid orders
   - View detailed order items
   - Print bill support

3. Credit / Unpaid System
   - Customer name & phone required for credit
   - Partial payments allowed
   - Automatic due calculation
   - Settlement with overpayment handling
   - Change return logic

4. Cash Drawer Logic
   - Denomination-based cash tracking
   - Greedy change return system
   - Real-time drawer total calculation
   - Owner cash withdrawal support
   - Withdrawal transaction safety

5. Reports & Analytics
   - Daily report (date-based)
   - Weekly summary
   - Monthly summary
   - Payment breakdown charts
   - Growth percentage calculation
   - CSV export support

------------------------------------------------------------

TECH STACK
----------

Frontend:
- React
- Vite
- TypeScript
- Tailwind
- Recharts

Backend:
- Express
- PostgreSQL
- JWT authentication
- Transaction-safe DB operations

Database:
- Orders
- Order Items
- Business Days
- Denominations
- Cash Withdrawals

------------------------------------------------------------

LOCAL SETUP
-----------

1. Clone repository
2. Setup Backend:

   cd backend
   npm install

   Create .env file:

   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_NAME=pos_db
   JWT_SECRET=your_secret
   PORT=3000

   Run backend:
   node index.js

3. Setup Frontend:

   cd frontend
   npm install

   Create .env file:

   VITE_API_URL=http://localhost:3000

   Run frontend:
   npm run dev

------------------------------------------------------------

PRODUCTION DEPLOYMENT (Render)
------------------------------

Backend:
- Deploy as Web Service
- Use PostgreSQL on Render
- Use DATABASE_URL
- Enable SSL

Frontend:
- Deploy as Static Site
- Set VITE_API_URL to backend URL

------------------------------------------------------------

ARCHITECTURE NOTES
------------------

- Orders page shows all orders.
- Reports are date-based (not business-day dependent).
- Business day controls drawer logic only.
- All cash operations use DB transactions.
- Withdrawal system prevents overdrawing denominations.

------------------------------------------------------------

STATUS
------

System includes:
✔ Business Day Control
✔ Cash Drawer Tracking
✔ Unpaid Credit Logic
✔ Withdrawal Logic
✔ Reports Dashboard
✔ CSV Export
✔ JWT Authentication

------------------------------------------------------------

Author
------
Built as a full-stack POS system with production-grade transactional safety and reporting architecture.

All Rights Reserved by me(Kang)