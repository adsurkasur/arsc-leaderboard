# ARSC Leaderboard

> Operational note (verified 2026-08-15): read [`docs/MAINTAINER_GUIDE.md`](docs/MAINTAINER_GUIDE.md) before development or deployment. This README contains older claims; current source and dated stage evidence take precedence. Preserved evidence records Stage 7 as locally validated but not remotely deployed.

A modern, real-time competition leaderboard application built for tracking and ranking participants across various competitive events. Features comprehensive user management, admin controls, and Indonesian language support.

## 🌟 Features

### Core Functionality
- **Real-time Leaderboard**: Live ranking system with top 10 display based on total competition participations
- **Global Ranking**: Sticky ranks that persist through searches and filters
- **User Authentication**: Secure login/signup with Supabase Auth
- **Role-based Access**: Admin and user roles with different permissions
- **Help Guide (Bantuan)**: In-app help documentation
- **About Section (Tentang)**: Application information and version

### Competition Management
- **Competition Tracking**: Add and manage various competitions
- **Participation Requests**: Users can submit participation requests for verification
- **Category Support**: Organize competitions by categories
- **Verification System**: Admin approval workflow for participations

### Admin Dashboard
- **User Management**: View, edit, and manage user accounts
- **Account Assignment**: Create accounts for users without email
- **Competition Oversight**: Create and manage competitions
- **Participation Verification**: Approve/reject participation requests
- **Notification System**: Real-time notifications for pending requests

### User Experience
- **Fluid Animations**: Spring-like animations for a more engaging experience
- **Responsive Design**: Mobile-first design with professional UI
- **Indonesian Language**: Complete localization in Bahasa Indonesia
- **Search & Filter**: Find users and competitions quickly
- **Real-time Updates**: Live data synchronization across all users

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router and Turbopack
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **ShadCN UI** - Modern component library built on Radix UI

### Backend & Database
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Supabase Auth** - User authentication and authorization
- **Row Level Security (RLS)** - Database-level security policies

### Development Tools
- **ESLint** - Code linting and formatting
- **React Hook Form** - Form management with validation
- **Zod** - Schema validation
- **TanStack Query** - Server state management

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **bun** package manager
- **Supabase** account and project

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd arsc-leaderboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   - Create a new Supabase project
   - Run the migration file: `supabase/migrations/20251218144952_e94de84e-a3ce-41d7-affa-d5b6ed534991.sql`
   - Update your Supabase URL and anon key in the `.env` file

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
app/                         # Next.js App Router pages
├── layout.tsx              # Root layout with providers
├── page.tsx                # Home page (leaderboard)
├── providers.tsx           # Client-side providers
├── globals.css             # Global styles
├── auth/page.tsx           # Authentication page
├── admin/page.tsx          # Admin dashboard
└── not-found.tsx           # 404 page
src/
├── components/              # Reusable UI components
│   ├── ui/                 # ShadCN UI components
│   ├── leaderboard/        # Leaderboard-specific components
│   ├── admin/              # Admin dashboard components
│   └── layout/             # Layout components
├── pages/                  # Page components
│   ├── Index.tsx          # Main leaderboard page
│   ├── Auth.tsx           # Authentication page
│   ├── Admin.tsx          # Admin dashboard
│   └── NotFound.tsx       # 404 page
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and type definitions
└── integrations/           # External service integrations
    └── supabase/           # Supabase client and types

supabase/
├── config.toml            # Supabase configuration
└── migrations/            # Database migrations
```

## 🗄️ Database Schema

### Core Tables

- **`profiles`** - User profiles with participation statistics
- **`competitions`** - Competition information and metadata
- **`participation_logs`** - Verified competition participations
- **`verification_requests`** - Pending participation requests
- **`user_roles`** - User role management (admin/user)

### Key Features

- **Row Level Security (RLS)** enabled on all tables
- **Real-time subscriptions** for live updates
- **Automatic ranking calculation** via database triggers
- **Secure role-based access** control

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

## 🌐 Deployment

### Build for Production
```bash
npm run build
```

### Deploy Options

**Recommended Platforms:**
- **Vercel** - Seamless React deployment
- **Netlify** - Great for static sites with forms
- **Railway** - Full-stack deployment with database
- **Supabase Edge Functions** - Serverless deployment

### Environment Variables for Production
Ensure these environment variables are set in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 👥 User Roles & Permissions

### Regular Users
- View leaderboard and rankings
- Submit participation requests
- Update their own profile
- Search and filter leaderboard

### Administrators
- All user permissions plus:
- Manage user accounts and roles
- Create and edit competitions
- Approve/reject participation requests
- View admin dashboard with analytics

## 🎨 UI/UX Features

- **Dark/Light Theme Support** - Automatic theme detection
- **Responsive Design** - Optimized for all screen sizes
- **Indonesian Localization** - Complete Bahasa Indonesia interface
- **Accessibility** - WCAG compliant components
- **Loading States** - Smooth loading animations
- **Error Handling** - User-friendly error messages

## 🔒 Security Features

- **Supabase RLS** - Database-level security
- **JWT Authentication** - Secure token-based auth
- **Input Validation** - Client and server-side validation
- **SQL Injection Protection** - Parameterized queries
- **XSS Protection** - Sanitized user inputs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

No `LICENSE` file is currently present in this repository. Confirm licensing and ownership terms with the project owner before external distribution.

## 🙏 Acknowledgments

- **Supabase** - For the amazing backend-as-a-service platform
- **ShadCN** - For the beautiful UI components
- **Tailwind CSS** - For the utility-first CSS framework
- **React Community** - For the excellent ecosystem

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Built with ❤️ for competitive communities**
