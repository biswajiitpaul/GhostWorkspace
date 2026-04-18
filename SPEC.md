# Ghost Workspace - Cloud Storage Application Specification

## Project Overview
- **Project Name**: Ghost Workspace
- **Type**: Full-stack web application (Flask + HTML/CSS/JS)
- **Core Functionality**: A Google Drive-style cloud storage application allowing users to create folders, upload files, view content, download and delete files
- **Target Users**: Anyone needing file organization and cloud storage

## Visual & UI Specification

### Layout Structure
- **Sidebar** (left, 260px width)
  - Logo/brand at top with Ghost Workspace name
  - Navigation links: Home, My Files, Recent
  - Theme toggle at bottom
  - Storage usage indicator

- **Main Area** (right, flex-grow)
  - **Top Navbar** (72px height)
    - Search bar (centered)
    - Upload button (right side)
    - Theme toggle icon
    - User avatar

  - **Content Area**
    - Breadcrumb navigation
    - Folder/File grid display
    - Empty state when no content

### Color Palette (CSS Variables)

**Light Mode**
- `--bg-primary`: #f4f5f7
- `--bg-secondary`: #ffffff
- `--bg-sidebar`: #ffffff
- `--text-primary`: #1a1d21
- `--text-secondary`: #6b7280
- `--accent-primary`: #4f8cff
- `--accent-primary-hover`: #3d7ae8
- `--border-color`: #e5e7eb

**Dark Mode**
- `--bg-primary`: #0f1419
- `--bg-secondary`: #1a2332
- `--bg-sidebar`: #141a24
- `--text-primary`: #e8eaed
- `--text-secondary`: #9aa0a6
- `--accent-primary`: #5a9fff
- `--accent-primary-hover`: #7ab3ff
- `--border-color`: #2d3748

### Typography
- **Font**: "Inter" from Google Fonts
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Sizes**: 14px base, 24px h1, 18px h2

### Components

**Folder Card**
- 200px width, flexible height
- Folder icon (colored, 52px)
- Folder name below (truncate with ellipsis)
- Hover: lift effect with shadow
- Click: navigate into folder

**File Card**
- 200px width, flexible height
- File type icon (48px)
- Filename below (truncate)
- File size badge
- Hover: lift effect with shadow
- Action buttons overlay (download, delete)

**Buttons**
- Primary: Filled with accent color
- Icon buttons: 42x42px circle
- Border radius: 10px (buttons), 16px (cards)

**Modal**
- Centered overlay
- Dark backdrop (rgba(0,0,0,0.5))
- White/dark card with 16px radius
- Close button

### Animations & Transitions
- All interactive elements: 150-300ms ease transitions
- Card hover: translateY(-2px to -4px) with shadow increase
- Modal: fade in 200ms
- Theme toggle: smooth color transition 300ms

## Functionality Specification

### Backend API Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | /api/folders | Create folder | JSON: { "folder_name": "name" } | { "success": true, "folder": {...} } |
| GET | /api/folders | List all folders | - | { "folders": [...] } |
| GET | /api/folders/<folder_name> | List files in folder | - | { "files": [...] } |
| POST | /api/upload | Upload file | multipart/form-data: file, folder_name | { "success": true, "file": {...} } |
| GET | /api/download/<folder>/<filename> | Download file | - | File stream |
| DELETE | /api/delete/<folder>/<filename> | Delete file | - | { "success": true } |

### Error Handling
- **400**: Missing folder name, duplicate folder, invalid file
- **404**: Folder not found, file not found
- **413**: File too large (>16MB)
- **500**: Server error

### File Handling
- Secure filename using `werkzeug.utils.secure_filename`
- Files stored in `uploads/<folder_name>/<filename>`
- Max file size: 16MB

## Frontend Features
1. **Create Folder Modal**
   - Input field for folder name
   - Create/Cancel buttons
   - Validation for empty name

2. **Upload File**
   - File input triggered by upload button
   - Folder selector dropdown
   - Success/error feedback via toast

3. **File Browser**
   - Grid view of folders/files
   - Click folder to enter
   - Breadcrumb navigation
   - Back button when inside folder

4. **File Actions**
   - Download button on each file
   - Delete button with confirmation

5. **Search**
   - Real-time filtering
   - Search by folder/file name

6. **Theme Toggle**
   - Light/Dark mode switch
   - Persists in localStorage

## Acceptance Criteria

1. User can create a new folder with valid name
2. User sees all folders in dashboard grid
3. User can click folder to view its files
4. User can upload a file to any folder
5. User can download a file
6. User can delete a file
7. Duplicate folder names are rejected with error
8. Files >16MB are rejected
9. Theme toggle switches between light/dark mode
10. All navigation is smooth without page reloads
11. Empty states show appropriate messages
12. Responsive behavior on window resize
