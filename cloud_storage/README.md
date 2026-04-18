# Cloud Storage Backend

A simple cloud storage backend built with Python and Flask.

## Project Structure

```
cloud_storage/
├── app.py              # Main Flask application
├── templates/
│   └── index.html      # Frontend HTML page
├── uploads/            # Uploaded files stored here (created automatically)
└── README.md
```

## Setup Instructions

### 1. Install Python

Make sure Python 3.7+ is installed. Download from https://www.python.org/downloads/

### 2. Install Dependencies

Open a terminal in the `cloud_storage` folder and run:

```bash
pip install flask
```

### 3. Run the Server

```bash
python app.py
```

You should see:
```
============================================================
  Cloud Storage Backend
============================================================
  Upload directory: D:\GhostWorkspace\cloud_storage\uploads
  Max file size: 16MB
============================================================

  Starting server at http://127.0.0.1:5000
  Press CTRL+C to stop
```

### 4. Open in Browser

Navigate to: **http://127.0.0.1:5000**

## How to Test

### Create a Folder
1. Enter a folder name (e.g., "documents", "photos")
2. Click "Create Folder"
3. You should see a success message

### Upload a File
1. Enter the target folder name (must exist first!)
2. Click "Select File" and choose a file
3. Click "Upload File"
4. You should see a success message

### View Folders and Files
1. Click "Refresh" to see all folders
2. Click a folder name to view its contents

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main web interface |
| POST | `/api/folders` | Create a folder (`{"folder_name": "name"}`) |
| GET | `/api/folders` | List all folders |
| GET | `/api/folders/<name>` | List files in a folder |
| POST | `/api/upload` | Upload file (form: `folder_name`, `file`) |

## Error Handling

- **409 Conflict**: Folder already exists
- **404 Not Found**: Folder doesn't exist when uploading
- **413 Request Entity Too Large**: File exceeds 16MB limit

## How It Works

1. **File Storage**: Files are saved to `uploads/<folder_name>/<filename>`
2. **Security**: Filenames are sanitized using `werkzeug.utils.secure_filename`
3. **Validation**: Only certain file extensions are allowed
4. **No Database**: Everything is stored directly on the filesystem

## Optional Extensions

To extend this system:

1. **Delete Functionality**: Add DELETE endpoints for files and folders
2. **File Listing**: View/download files from the browser
3. **Cloud Storage**: Replace local `uploads/` folder with AWS S3, Google Cloud Storage, or Azure Blob
4. **Authentication**: Add user login with Flask-Login or JWT tokens
5. **Database**: Use SQLite/PostgreSQL to track files and metadata
6. **File Size Limits**: Different limits per user or folder
7. **File Types**: Restrict uploads by MIME type, not just extension
