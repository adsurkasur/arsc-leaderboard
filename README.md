# Leaderboard Nexus

A modern competition leaderboard application built with React, TypeScript, and Supabase.

## Features

- Real-time leaderboard with global ranking
- User authentication and role management
- Competition participation tracking
- Admin dashboard for managing users and competitions
- Responsive design with Indonesian language support
- Search and filter functionality

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **UI**: ShadCN UI, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **State Management**: TanStack Query
- **Forms**: React Hook Form, Zod validation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd leaderboard-nexus
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Set up environment variables:
Create a `.env` file with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
# or
bun run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # ShadCN UI components
│   ├── leaderboard/    # Leaderboard-specific components
│   ├── admin/          # Admin dashboard components
│   └── layout/         # Layout components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and types
└── integrations/       # External service integrations
```

## Deployment

This application can be deployed to any static hosting service like Vercel, Netlify, or GitHub Pages.

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting provider.
