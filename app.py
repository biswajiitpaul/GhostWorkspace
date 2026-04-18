"""
Ghost Workspace — app.py  (production-ready, Python 3.11/3.12)
Supabase Storage REST API via `requests` — no Supabase Python SDK required.
All credentials loaded from .env — never hardcoded.

Dependencies (pip install):
    flask
    python-dotenv
    requests
"""

import os
import json
import requests
from flask import Flask, request, jsonify, render_template, session, redirect
from werkzeug.utils import secure_filename
from functools import wraps
from dotenv import load_dotenv

# ── Load .env ────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL   = os.environ["SUPABASE_URL"]     # crashes early if missing
SUPABASE_KEY   = os.environ["SUPABASE_KEY"]     # crashes early if missing
BUCKET         = os.getenv("SUPABASE_BUCKET", "ghost-storage")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me-in-env")
SECRET_KEY     = os.getenv("SECRET_KEY",     "change-me-in-env")

# ── Supabase REST helpers ────────────────────────────────────────
BASE_STORAGE = f"{SUPABASE_URL}/storage/v1"

AUTH_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}


def _storage_list(path=""):
    """
    List objects inside a bucket (optionally inside a virtual folder).
    Returns a plain list; never raises — logs errors and returns [].
    """
    url  = f"{BASE_STORAGE}/object/list/{BUCKET}"
    body = {
        "prefix":    path,
        "limit":     1000,
        "offset":    0,
        "sortBy":    {"column": "name", "order": "asc"},
    }
    try:
        resp = requests.post(url, json=body, headers=AUTH_HEADERS, timeout=15)
        resp.raise_for_status()
        result = resp.json()
        print(f"[_storage_list] path={path!r}  count={len(result)}")
        return result if isinstance(result, list) else []
    except Exception as exc:
        print(f"[_storage_list] ERROR path={path!r}: {exc}")
        return []


def _storage_upload(cloud_path, data, content_type="application/octet-stream", upsert=False):
    """
    Upload bytes to Supabase Storage.
    Returns the requests.Response object so callers can inspect status.
    """
    url = f"{BASE_STORAGE}/object/{BUCKET}/{cloud_path}"
    headers = {
        **AUTH_HEADERS,
        "Content-Type": content_type,
        "x-upsert":     "true" if upsert else "false",
    }
    return requests.post(url, data=data, headers=headers, timeout=30)


def _storage_remove(paths: list):
    """
    Delete one or more objects from Supabase Storage.
    `paths` is a list of full object paths (no bucket prefix).
    """
    url  = f"{BASE_STORAGE}/object/{BUCKET}"
    body = {"prefixes": paths}
    resp = requests.delete(url, json=body, headers=AUTH_HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _storage_signed_url(cloud_path, expires_in=120):
    """
    Create a temporary signed download URL.
    Returns the URL string or None on failure.
    """
    url  = f"{BASE_STORAGE}/object/sign/{BUCKET}/{cloud_path}"
    body = {"expiresIn": expires_in}
    try:
        resp = requests.post(url, json=body, headers=AUTH_HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        # Supabase returns { signedURL: "..." } or { signedUrl: "..." }
        signed = (data.get("signedURL")
                  or data.get("signedUrl")
                  or data.get("signed_url"))
        if signed and not signed.startswith("http"):
            signed = f"{SUPABASE_URL}{signed}"
        return signed
    except Exception as exc:
        print(f"[_storage_signed_url] ERROR {cloud_path}: {exc}")
        return None


# ── Flask app ────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key                   = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024   # 16 MB


# ════════════════════════════════════════════════════════════════
#  HELPERS
# ════════════════════════════════════════════════════════════════

def success(data=None, message="OK", code=200):
    return jsonify({"status": "success", "message": message,
                    "data": data or {}}), code

def error(message="An error occurred", code=400):
    return jsonify({"status": "error", "message": message, "data": {}}), code

def human_size(num_bytes):
    if not num_bytes:
        return "0 B"
    for unit in ("B", "KB", "MB", "GB"):
        if num_bytes < 1024:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024
    return f"{num_bytes:.1f} TB"

def is_folder(item: dict) -> bool:
    """
    Supabase Storage signals virtual folders by returning entries where
    BOTH id AND metadata are None/absent.  A real file always has both.
    """
    item_id  = item.get("id")
    metadata = item.get("metadata")
    name     = item.get("name", "")

    if item_id is None and metadata is None:
        return True
    if item_id is None and metadata == {}:
        return True
    if "." not in name and not (metadata or {}).get("size"):
        return True
    return False


# ════════════════════════════════════════════════════════════════
#  AUTH
# ════════════════════════════════════════════════════════════════

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return error("Unauthorized — please log in", 401)
        return f(*args, **kwargs)
    return decorated

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    pwd  = data.get("password", "")
    if not pwd:
        return error("Password is required", 400)
    if pwd != ADMIN_PASSWORD:
        return error("Invalid password", 401)
    session["logged_in"] = True
    return success(message="Authenticated")

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return success(message="Logged out")


# ════════════════════════════════════════════════════════════════
#  FRONTEND
# ════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return render_template("index.html")


# ════════════════════════════════════════════════════════════════
#  DEBUG — remove before deploying to production
# ════════════════════════════════════════════════════════════════

@app.route("/api/debug")
def debug_bucket():
    """Open http://127.0.0.1:5000/api/debug to inspect raw bucket data."""
    raw = _storage_list()
    return jsonify({
        "supabase_rest_ok": True,
        "bucket":           BUCKET,
        "raw_count":        len(raw),
        "items": [{
            "name":        item.get("name"),
            "id":          item.get("id"),
            "metadata":    item.get("metadata"),
            "created_at":  item.get("created_at"),
            "detected_as": "FOLDER" if is_folder(item) else "FILE",
        } for item in raw],
    })


# ════════════════════════════════════════════════════════════════
#  FOLDERS
# ════════════════════════════════════════════════════════════════

@app.route("/api/folders", methods=["POST"])
@login_required
def create_folder():
    body = request.get_json(silent=True) or {}
    name = body.get("name", "").strip()

    if not name:
        return error("Folder name is required", 400)
    safe = secure_filename(name)
    if not safe:
        return error("Invalid folder name — use letters, numbers, dashes", 400)

    # Duplicate check
    existing = _storage_list(safe)
    if any(item.get("name") == ".keep" for item in existing):
        return error(f'Folder "{safe}" already exists', 409)

    resp = _storage_upload(
        cloud_path   = f"{safe}/.keep",
        data         = b"ghost-placeholder",
        content_type = "text/plain",
        upsert       = False,
    )

    if resp.status_code in (200, 201):
        print(f"[create_folder] OK: {safe}")
        return success({"name": safe}, "Folder created", 201)

    msg = resp.text.lower()
    if any(k in msg for k in ("already exists", "duplicate", "23505")):
        return error(f'Folder "{safe}" already exists', 409)

    print(f"[create_folder] ERROR {resp.status_code}: {resp.text}")
    return error(resp.text or "Could not create folder", 500)


@app.route("/api/folders", methods=["GET"])
@login_required
def list_folders():
    items   = _storage_list()
    folders = []

    for item in items:
        print(f"  item: name={item.get('name')!r} "
              f"id={item.get('id')!r} metadata={item.get('metadata')!r} "
              f"-> folder={is_folder(item)}")

        if not is_folder(item):
            continue

        fname    = item.get("name", "")
        children = _storage_list(fname)
        count    = sum(1 for c in children
                       if c.get("name") != ".keep" and not is_folder(c))

        folders.append({
            "name":          fname,
            "file_count":    count,
            "created_human": (item.get("created_at") or "")[:10],
        })

    print(f"[list_folders] returning {len(folders)} folder(s)")
    return success({"folders": folders}, f"{len(folders)} folder(s)")


@app.route("/api/folders/<folder_name>", methods=["GET"])
@login_required
def list_folder_files(folder_name):
    safe  = secure_filename(folder_name)
    items = _storage_list(safe)
    files = []

    for item in items:
        if item.get("name") == ".keep" or is_folder(item):
            continue
        meta = item.get("metadata") or {}
        name = item["name"]
        files.append({
            "name":           name,
            "size_human":     human_size(meta.get("size")),
            "modified_human": (item.get("updated_at") or "")[:16].replace("T", " "),
            "ext":            name.rsplit(".", 1)[-1] if "." in name else "",
            "mime":           meta.get("mimetype", "application/octet-stream"),
        })

    return success({"folder": safe, "files": files}, f"{len(files)} file(s)")


@app.route("/api/folders/<folder_name>", methods=["DELETE"])
@login_required
def delete_folder(folder_name):
    safe  = secure_filename(folder_name)
    items = _storage_list(safe)
    paths = [f"{safe}/{item['name']}" for item in items if item.get("name")]

    try:
        if paths:
            _storage_remove(paths)
        return success({}, f'Folder "{safe}" deleted')
    except Exception as exc:
        return error(str(exc), 500)


# ════════════════════════════════════════════════════════════════
#  FILES — upload / download / delete / recent
# ════════════════════════════════════════════════════════════════

@app.route("/api/upload", methods=["POST"])
@login_required
def upload_to_cloud():
    file   = request.files.get("file")
    folder = request.form.get("folder", "").strip()

    if not file or file.filename == "":
        return error("No file provided", 400)
    if not folder:
        return error("folder field is required", 400)

    safe_folder   = secure_filename(folder)
    safe_filename = secure_filename(file.filename)
    cloud_path    = f"{safe_folder}/{safe_filename}"
    print(f"[upload] {cloud_path}")

    resp = _storage_upload(
        cloud_path   = cloud_path,
        data         = file.read(),
        content_type = file.content_type or "application/octet-stream",
        upsert       = False,
    )

    if resp.status_code in (200, 201):
        return success({"name": safe_filename}, "File uploaded!", 201)

    msg = resp.text.lower()
    if "already exists" in msg or "duplicate" in msg:
        return error("A file with that name already exists in this folder", 409)

    print(f"[upload] ERROR {resp.status_code}: {resp.text}")
    return error(resp.text or "Upload failed", 500)


@app.route("/api/download/<folder_name>/<filename>", methods=["GET"])
@login_required
def download_file(folder_name, filename):
    safe_folder   = secure_filename(folder_name)
    safe_filename = secure_filename(filename)
    cloud_path    = f"{safe_folder}/{safe_filename}"

    signed_url = _storage_signed_url(cloud_path, expires_in=120)
    if not signed_url:
        return error("Could not generate download link", 500)

    return redirect(signed_url)


@app.route("/api/delete/<folder_name>/<filename>", methods=["DELETE"])
@login_required
def delete_file(folder_name, filename):
    safe_folder   = secure_filename(folder_name)
    safe_filename = secure_filename(filename)
    try:
        _storage_remove([f"{safe_folder}/{safe_filename}"])
        return success({}, "File deleted")
    except Exception as exc:
        return error(str(exc), 500)


@app.route("/api/files", methods=["GET"])
@login_required
def list_all_files():
    """Flat list of every file across all folders — used by Recent view."""
    all_files = []
    for item in _storage_list():
        if not is_folder(item):
            continue
        folder_name = item["name"]
        for child in _storage_list(folder_name):
            if child.get("name") == ".keep" or is_folder(child):
                continue
            meta  = child.get("metadata") or {}
            cname = child["name"]
            all_files.append({
                "name":           cname,
                "folder":         folder_name,
                "size_human":     human_size(meta.get("size")),
                "modified_human": (child.get("updated_at") or "")[:16].replace("T", " "),
                "ext":            cname.rsplit(".", 1)[-1] if "." in cname else "",
                "mime":           meta.get("mimetype", ""),
            })
    return success({"files": all_files}, f"{len(all_files)} file(s)")


# ════════════════════════════════════════════════════════════════
#  ERROR HANDLERS
# ════════════════════════════════════════════════════════════════

@app.errorhandler(413)
def payload_too_large(_):
    return error("File exceeds the 16 MB size limit", 413)

@app.errorhandler(404)
def not_found(_):
    return error("Route not found", 404)

@app.errorhandler(405)
def method_not_allowed(_):
    return error("Method not allowed", 405)

@app.errorhandler(500)
def server_error(_):
    return error("Internal server error", 500)


if __name__ == "__main__":
    app.run(debug=True, port=5000)