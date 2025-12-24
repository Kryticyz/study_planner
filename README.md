# ANU Engineering Study Planner

A web-based study planning tool for students pursuing the Bachelor of Engineering (Honours) degree at the Australian National University (ANU). Plan your course schedule across 4 years (8 semesters) while tracking degree requirements and validating prerequisites.

## Features

- **Drag-and-drop course planning** across an 8-semester grid
- **Real-time prerequisite validation** with support for alternative prerequisites
- **Degree progress tracking** for all requirement categories
- **Multiple study plans** with comparison view
- **Import/export plans** as JSON for backup and sharing
- **Flexible start options** - begin in Semester 1 or Semester 2

## Running Locally

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd study_planner

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint to check code quality |

## Directory Structure

```
study_planner/
├── src/                    # Main source code
│   ├── components/         # React UI components
│   ├── store/              # Zustand state management
│   ├── data/               # Course catalog and degree requirements
│   ├── types.ts            # TypeScript type definitions
│   ├── App.tsx             # Root React component
│   ├── main.tsx            # Application entry point
│   └── index.css           # Tailwind CSS and custom styles
├── public/                 # Static assets
├── scripts/                # Utility scripts (course scraper)
└── dist/                   # Production build output
```

### `/src/components/`

React components that make up the user interface:

| Component | Purpose |
|-----------|---------|
| `Header.tsx` | Top navigation bar with export, import, and compare buttons |
| `SemesterGrid.tsx` | Main 4-year, 8-semester planning grid |
| `SemesterSlot.tsx` | Individual semester cell that accepts dropped courses |
| `CourseCard.tsx` | Draggable course card with validation indicators |
| `CoursePanel.tsx` | Side panel for browsing and searching available courses |
| `CourseModal.tsx` | Modal displaying detailed course information |
| `RequirementsTracker.tsx` | Sidebar showing degree progress |
| `ComparisonView.tsx` | Side-by-side plan comparison |
| `PlanSelector.tsx` | Interface for managing multiple study plans |

### `/src/store/`

State management using Zustand with localStorage persistence:

| Store | Purpose |
|-------|---------|
| `planStore.ts` | Core study plan logic, course placement, and validation |
| `uiStore.ts` | UI state (modals, filters, selected items) |

### `/src/data/`

Static data defining courses and degree requirements:

| File | Purpose |
|------|---------|
| `courses.ts` | Comprehensive course catalog with prerequisites, availability, and metadata |
| `requirements.ts` | Degree requirements for BE (Hons) including major specifications |

### `/scripts/`

Utility scripts for data maintenance:

| File | Purpose |
|------|---------|
| `course_scraper.py` | Python script to scrape course data from ANU Programs & Courses |
| `requirements.txt` | Python dependencies for the scraper |

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **@dnd-kit** - Drag-and-drop functionality
- **Lucide React** - Icon library

## Data Persistence

Study plans are automatically saved to browser localStorage. Use the export feature to create JSON backups that can be imported later or shared with others.

## License

Private project - not licensed for redistribution.
