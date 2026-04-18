# Ghost Workspace

Secure cloud workspace for managing folders and files through a clean web interface. Files are stored in cloud storage, so they do not consume local device storage.

## Features

* Secure login
* Folder management
* File upload and download
* Delete files and folders
* Cloud-based storage (no local storage usage)
* Responsive UI

## Tech Stack

* Python Flask
* Supabase Storage
* HTML, CSS, JavaScript

## Local Setup

```bash id="n7tlc7"
git clone https://github.com/biswajitpaul/GhostWorkspace.git
cd GhostWorkspace
pip install -r requirements.txt
python app.py
```

Create a `.env` file:

```env id="67w2ji"
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_BUCKET=
ADMIN_PASSWORD=
SECRET_KEY=
```

## About

Built as a personal project to create a simple and modern cloud storage workspace.

## Deployment

Compatible with Vercel, Render, and Railway.

## Author

Biswajit Paul
