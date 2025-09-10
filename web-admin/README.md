# WNBA LED Scoreboard Web Admin

A modern, cloud-first web administration interface for managing WNBA LED scoreboards built with Next.js, TypeScript, and Supabase.

## 🚀 Features

- **Modern UI Framework**: Built with Next.js 14, TypeScript, and TailwindCSS
- **Real-time Updates**: WebSocket-based real-time device status and configuration updates
- **Device Management**: Comprehensive device configuration, monitoring, and control
- **Team Management**: Advanced favorites editor with drag-and-drop functionality
- **Dark Mode**: Full dark mode support with system preference detection
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and screen readers
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## 📋 Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **Supabase Account**: For backend services (database, auth, real-time)

## 🛠️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/stevebargelt/wnba-led-scoreboard.git
cd wnba-led-scoreboard/web-admin
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the web-admin directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Edge Functions
NEXT_PUBLIC_FUNCTION_ON_CONFIG_WRITE=https://your_supabase_project.functions.supabase.co/on-config-write
NEXT_PUBLIC_FUNCTION_ON_ACTION=https://your_supabase_project.functions.supabase.co/on-action
NEXT_PUBLIC_FUNCTION_MINT_DEVICE_TOKEN=https://your_supabase_project.functions.supabase.co/mint-device-token
```

### 4. Database Setup

The application requires the following Supabase database tables:

- `devices` - Device registration and status
- `configs` - Device configuration history
- `events` - Device event logs

Refer to the [Database Schema](#database-schema) section for detailed table structures.

## 🚀 Development

### Start the development server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint for code quality checks
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run type-check` - Run TypeScript type checking

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage

The project maintains high test coverage with the following targets:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Test Structure

```
src/
├── components/
│   └── ui/
│       └── __tests__/          # Component unit tests
├── __tests__/                  # Integration tests
└── pages/                      # Page-level tests (if needed)
```

## 📚 Architecture

### Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: TailwindCSS with design system
- **Backend**: Supabase (PostgreSQL, Auth, Real-time, Edge Functions)
- **Testing**: Jest + React Testing Library
- **Linting**: ESLint with accessibility rules

### Project Structure

```
web-admin/
├── src/
│   ├── components/
│   │   ├── layout/             # Layout components (Header, Navigation)
│   │   └── ui/                 # Reusable UI components
│   ├── contexts/               # React contexts (Theme, Auth)
│   ├── lib/                    # Utility libraries and configurations
│   ├── pages/                  # Next.js pages
│   └── styles/                 # Global styles and Tailwind config
├── public/                     # Static assets
└── __tests__/                  # Test files
```

### Component Architecture

The UI is built using a design system approach with reusable components:

- **Base Components**: Button, Input, Badge, Card
- **Composite Components**: Tabs, StatusBadge, ThemeToggle
- **Layout Components**: Header, Navigation, Layout wrapper
- **Page Components**: Device management, registration forms

## 🎨 Design System

### Theme Support

- **Light Mode**: Professional light theme with high contrast
- **Dark Mode**: Dark theme optimized for low-light environments
- **System Preference**: Automatically detects user's system preference

### Color Palette

```css
/* Primary Colors */
--primary-50: #eff6ff;
--primary-500: #3b82f6;
--primary-600: #2563eb;
--primary-900: #1e3a8a;

/* Success, Warning, Error colors... */
```

### Typography

- **Font Family**: System fonts (-apple-system, BlinkMacSystemFont, Segoe UI)
- **Font Sizes**: Responsive scale from text-xs to text-4xl
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

## 🔐 Security

### Authentication

- Supabase Auth with JWT tokens
- Row Level Security (RLS) policies
- Device ownership verification

### Data Protection

- All API calls use authenticated requests
- Device tokens are securely generated and have limited TTL
- No sensitive data stored in localStorage

## 📊 Database Schema

### Devices Table

```sql
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  user_id uuid REFERENCES auth.users(id),
  last_seen_ts timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Configs Table

```sql
CREATE TABLE configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id),
  content jsonb NOT NULL,
  version_ts timestamptz DEFAULT now()
);
```

### Events Table

```sql
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id),
  type text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Configuration

### Device Configuration Schema

The application supports comprehensive device configuration:

```json
{
  "timezone": "America/Los_Angeles",
  "matrix": {
    "width": 64,
    "height": 32,
    "brightness": 80
  },
  "refresh": {
    "pregame_sec": 30,
    "ingame_sec": 5,
    "final_sec": 60
  },
  "favorites": [
    {
      "name": "Las Vegas Aces",
      "abbr": "LV",
      "id": "1611661313"
    }
  ]
}
```

## 📖 API Reference

### Device Actions

- `PING` - Test device connectivity
- `RESTART` - Restart device application
- `FETCH_ASSETS` - Update team logos and assets
- `SELF_TEST` - Run hardware diagnostic tests

### Configuration Management

- `Apply Config` - Deploy configuration to device
- `Load Latest Config` - Retrieve last saved configuration
- `Sync Favorites` - Update favorites in JSON configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feat/amazing-feature`)
8. Open a Pull Request

### Code Quality Standards

- All code must be TypeScript
- Maintain 80%+ test coverage
- Follow ESLint configuration
- Use Prettier for code formatting
- Include accessibility attributes (ARIA labels, roles)

## 🐛 Troubleshooting

### Common Issues

**Build Failures**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Environment Variables**
- Ensure all required environment variables are set
- Check Supabase project URL and API keys
- Verify Edge Function URLs are correct

**Database Connection Issues**
- Verify Supabase project is active
- Check RLS policies are properly configured
- Ensure user has proper permissions

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/stevebargelt/wnba-led-scoreboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/stevebargelt/wnba-led-scoreboard/discussions)
- **Documentation**: [Project Wiki](https://github.com/stevebargelt/wnba-led-scoreboard/wiki)

## 🔄 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for details on releases and updates.

---

**Built with ❤️ for the WNBA community**
