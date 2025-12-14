# MindFlow - Mind Mapping Application

## Overview

MindFlow is a professional, markdown-enabled mind mapping tool built for creative thinking and project planning. The application provides an interactive canvas where users can create, edit, and organize nodes in a visual mind map format. Key features include:

- Interactive node-based canvas using React Flow
- Full markdown support with math formula rendering (KaTeX)
- Multiple theme options (light, dark, ocean, forest, etc.)
- Export capabilities (PNG, SVG, PDF, JSON)
- Auto-layout with dagre graph algorithm
- Emoji support in nodes

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React with TypeScript
- **Build Tool**: Vite with custom plugins for Replit integration
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Mind Map Canvas**: @xyflow/react (React Flow) for node-based visualization
- **Graph Layout**: dagre library for automatic node positioning

### Backend Architecture

- **Runtime**: Node.js with Express
- **Language**: TypeScript with tsx for development
- **API Structure**: RESTful endpoints prefixed with `/api`
- **Static Serving**: Express serves built client assets in production

### Data Storage

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts`
- **Current Storage**: In-memory storage implementation (`MemStorage` class)
- **Database Ready**: Configured for PostgreSQL via `DATABASE_URL` environment variable

### Build System

- **Client Build**: Vite outputs to `dist/public`
- **Server Build**: esbuild bundles server to `dist/index.cjs`
- **Shared Code**: `shared/` directory contains code used by both client and server

### Project Structure

```
client/           # Frontend React application
  src/
    components/   # UI components (shadcn/ui + custom)
    hooks/        # React hooks
    lib/          # Utilities, themes, layout helpers
    pages/        # Page components
server/           # Backend Express application
shared/           # Shared types and schema
migrations/       # Drizzle database migrations
```

## External Dependencies

### Third-Party Libraries

- **React Flow (@xyflow/react)**: Interactive node-based diagrams
- **dagre**: Directed graph layout algorithm
- **react-markdown + remark-gfm**: Markdown rendering in nodes
- **rehype-katex + remark-math**: LaTeX math formula support
- **html-to-image**: Export canvas to PNG/SVG
- **jsPDF**: PDF export functionality
- **nanoid**: Unique ID generation

### Database

- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **connect-pg-simple**: Session storage for PostgreSQL

### UI Framework

- **shadcn/ui**: Pre-built accessible components
- **Radix UI**: Headless UI primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library

### Fonts (CDN)

- Inter (sans-serif)
- JetBrains Mono (monospace)
- KaTeX CSS for math rendering
