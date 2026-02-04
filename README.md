# EPYC Courier Service Portals

A multi-portal delivery management platform for EPYC Courier Service (UDIG Solutions Inc), Southern California's premier same-day courier service.

## Portals

| Portal | URL | Description |
|--------|-----|-------------|
| **Client Portal** | `localhost:3000` | Customer-facing portal for booking, tracking, and managing deliveries |
| **Driver Portal** | `localhost:3001` | Driver app for onboarding, accepting jobs, and managing earnings |
| **Dispatch Portal** | `localhost:3002` | Internal dashboard for dispatchers to manage deliveries and drivers |

## Tech Stack

- **Framework:** Next.js 15 with React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS with EPYC brand colors
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (driver documents)
- **Monorepo:** Turborepo with pnpm workspaces

## Project Structure

```
epyc-portals/
├── apps/
│   ├── client-portal/     # Customer portal (port 3000)
│   ├── driver-portal/     # Driver portal (port 3001)
│   └── dispatch/          # Dispatch dashboard (port 3002)
├── packages/
│   ├── shared/            # Shared types, constants, utilities
│   └── supabase/          # Database migrations
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SuaveTN35/epyc-portals.git
   cd epyc-portals
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run database migrations in Supabase SQL Editor (files in `packages/supabase/migrations/`)

5. Start the development servers:
   ```bash
   pnpm dev
   ```

## Features

### Client Portal
- User registration and authentication
- Request delivery quotes
- Book same-day deliveries
- Real-time package tracking
- Delivery history and management
- Payment management

### Driver Portal
- Driver application and onboarding
- Document upload (license, insurance, vehicle photos)
- Vehicle registration with dimensions and cargo capacity
- Job board with available deliveries
- Active delivery management
- Earnings tracking and history
- Proof of delivery capture

### Dispatch Portal
- Real-time delivery dashboard
- Driver management and approval
- Delivery assignment
- Live map view
- Analytics and reporting
- Support ticket management

## EPYC Brand Colors

```css
epyc-primary:   #047857  /* Dark Green */
epyc-secondary: #059669  /* Medium Green */
epyc-accent:    #10B981  /* Emerald highlight */
epyc-green:     #047857  /* Gradient start */
epyc-teal:      #0d7490  /* Gradient middle */
epyc-blue:      #0369a1  /* Gradient end */
```

## Database Schema

Key tables:
- `profiles` - User profiles with roles (customer, driver, dispatcher, admin)
- `drivers` - Driver information, vehicle details, documents
- `deliveries` - Delivery orders with status tracking
- `delivery_updates` - Real-time status updates and location tracking

## Scripts

```bash
pnpm dev          # Start all portals in development mode
pnpm build        # Build all portals for production
pnpm lint         # Run ESLint across all packages
```

## Contact

**EPYC Courier Service**
UDIG Solutions Inc
Website: [epyccs.com](https://epyccs.com)
Phone: (818) 217-0070

## License

Proprietary - UDIG Solutions Inc. All rights reserved.
