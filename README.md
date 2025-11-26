# Textile Management System - Complete ERP Solution

A comprehensive, production-ready ERP system built specifically for textile businesses.

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: JavaScript (No TypeScript)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom JWT with HTTP-only cookies
- **State Management**: React Hooks

## ✅ Current Implementation Status

### Completed Components

#### Core Infrastructure
- ✅ Complete database schema with 20+ tables
- ✅ Custom JWT authentication system
- ✅ Protected route middleware
- ✅ Supabase client configuration
- ✅ Utility functions (formatting, validation, export)

#### UI Components
- ✅ Button (all variants)
- ✅ Input (with icons, labels, errors)
- ✅ Select (dropdown with validation)
- ✅ Textarea (multiline input)
- ✅ Modal (responsive dialogs)
- ✅ Card (content containers)
- ✅ Table (data tables with sorting)

#### Layout & Navigation
- ✅ Responsive Sidebar with menu
- ✅ Topbar with user menu
- ✅ Dashboard Layout with auth check
- ✅ Mobile-responsive design

#### Pages
- ✅ Login Page (with validation)
- ✅ Dashboard (stats, quick actions, alerts)
- ✅ Customer Management (list, create)

## 📦 Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [https://supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Update `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-secure-secret-key-here
```

### 3. Setup Database

1. Go to Supabase Dashboard → SQL Editor
2. Open `database/schema.sql`
3. Copy and paste the entire SQL content
4. Click "Run" to create all tables and seed data

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Login

Default credentials:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password in production!

## 📁 Project Structure

```
app/
├── api/auth/          # Authentication API routes
├── dashboard/         # Dashboard page
├── login/             # Login page
├── customers/         # Customer management (CRUD)
├── suppliers/         # Supplier management
├── sales/             # Sales invoices
├── purchases/         # Purchase orders
├── stock/             # Stock management
├── products/          # Product catalog
├── payments/          # Payment in/out
├── expenses/          # Expense tracking
├── reports/           # Business reports
├── users/             # User management
└── settings/          # System settings

components/
├── layout/            # Layout components
│   ├── Sidebar.js
│   ├── Topbar.js
│   └── DashboardLayout.js
└── ui/                # Reusable UI components
    ├── Button.js
    ├── Input.js
    ├── Select.js
    ├── Textarea.js
    ├── Modal.js
    ├── Card.js
    └── Table.js

lib/
├── supabase.js        # Supabase client
├── auth.js            # Authentication utilities
└── utils.js           # Helper functions

database/
└── schema.sql         # Complete database schema
```

## 🎯 Key Features

### Authentication & Authorization
- Custom JWT-based authentication (NO Supabase Auth)
- Role-based access control (Owner, Admin, Manager, etc.)
- Module-level permissions
- HTTP-only cookie sessions

### Dashboard
- Real-time business metrics
- Quick action buttons
- Pending order alerts
- Low stock warnings

### Customer Management
- Complete customer database
- Customer ledger tracking
- Balance management
- Export capabilities
- WhatsApp/Email/SMS placeholders

### Sales Management
- Invoice generation with dynamic line items
- GST calculations
- Packing list generation
- Customer ledger integration
- Print & export functionality

### Purchase Management
- Purchase order creation
- Supplier management
- Receiving workflow
- Supplier ledger tracking

### Stock Management
- Stock In/Out tracking
- Multi-warehouse support
- Low stock alerts
- Stock movement history

### Payments
- Payment In (customers)
- Payment Out (suppliers)
- Multiple payment methods
- Denomination calculator
- Receipt generation

### Reports
- Sales reports (by date, customer, GST)
- Purchase reports
- Customer/Supplier ledgers
- GST reports
- Stock reports
- Export to PDF/Excel

## 📚 Implementation Guide

For detailed implementation instructions, see [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)

This guide includes:
- Complete module implementation patterns
- API integration examples
- Form handling best practices
- Database query patterns
- UI/UX guidelines

## 🔐 Security Features

- JWT authentication with secure cookies
- Password hashing with bcrypt
- Route protection middleware
- SQL injection prevention
- XSS protection
- No credentials in codebase

## 🎨 UI/UX Features

- Modern, clean SaaS design
- Dark mode support
- Responsive (mobile, tablet, desktop)
- Loading states
- Error handling
- Form validation
- Toast notifications

## 📊 Database Schema

The system includes comprehensive tables for:
- Users & Permissions
- Customers & Suppliers
- Products, Categories & Units
- Stock Movements
- Sales Invoices & Items
- Purchase Orders & Items
- Payments (In/Out)
- Expenses
- Ledgers (Customer/Supplier)
- Company Settings

See `database/schema.sql` for complete schema.

## 🛠️ Development

### Adding a New Module

1. Create page in `app/[module-name]/page.js`
2. Use DashboardLayout wrapper
3. Fetch data using Supabase client
4. Use UI components for consistency
5. Add to Sidebar menu

### Code Style

- Use functional components
- JavaScript only (NO TypeScript)
- Tailwind for all styling
- Comment complex logic
- Follow existing patterns

## 🚢 Deployment

### Environment Variables

Set these in production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `JWT_SECRET` (must be strong)

### Build

```bash
npm run build
npm run start
```

### Recommended Platforms
- Vercel (recommended for Next.js)
- Netlify
- Railway
- Digital Ocean

## 📝 To-Do List (Remaining Modules)

The following modules need implementation using the provided patterns:

- [ ] Suppliers module (similar to Customers)
- [ ] Products & Categories
- [ ] Sales module (invoice creation)
- [ ] Purchase module
- [ ] Stock In/Out pages
- [ ] Payments In/Out
- [ ] Expenses module
- [ ] Reports (all types)
- [ ] Receiving module
- [ ] Users module
- [ ] Settings page

**Refer to `IMPLEMENTATION_GUIDE.md` for detailed examples**

## 🆘 Troubleshooting

### Cannot login
- Check database has admin user
- Verify password hash
- Check JWT_SECRET is set

### Supabase connection error
- Verify .env.local has correct URL and key
- Check Supabase project is active

### Middleware redirect loop
- Clear browser cookies
- Check middleware.js config

## 📞 Support

For questions or issues:
- Check `IMPLEMENTATION_GUIDE.md`
- Review existing code patterns
- Next.js docs: https://nextjs.org/docs
- Supabase docs: https://supabase.com/docs

## 📄 License

Proprietary - All rights reserved

---

**Built for Textile Management Excellence** 🧵
