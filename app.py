from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_file, abort , send_from_directory
import mysql.connector
from mysql.connector import errorcode
import os, io, json, bcrypt, datetime, zipfile , openpyxl
from werkzeug.utils import secure_filename
import pandas as pd
from difflib import get_close_matches
import traceback
from datetime import datetime
from openpyxl.workbook import Workbook
from dotenv import load_dotenv
load_dotenv()  # Load .env variables
from dateutil import parser
from PIL import Image
from PyPDF2 import PdfReader, PdfWriter
import io




app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")  # change to a secure key in production
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024   # 200 MB
from werkzeug.formparser import FormDataParser
FormDataParser.max_form_memory_size = 200 * 1024 * 1024
FormDataParser.max_form_parts = 5000
from werkzeug.wsgi import LimitedStream
LimitedStream.total_content_length = 200 * 1024 * 1024

# -----------------------
# DB CONFIG (adjust pw if needed)
# -----------------------
DB_CONFIG = {
    'host': os.getenv("DB_HOST"),
    'user': os.getenv("DB_USER"),
    'password': os.getenv("DB_PASSWORD"),
    'database': os.getenv("DB_NAME")
}
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER



# -----------------------
# DB helpers and init
# -----------------------
def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def init_database():
    # create database if needed (connect without database)
    try:
        conn0 = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )
        conn0.autocommit = True
        cur0 = conn0.cursor()
        cur0.execute("CREATE DATABASE IF NOT EXISTS " + DB_CONFIG['database'])
        cur0.close()
        conn0.close()
    except Exception as e:
        print("DB create error (may already exist):", e)

    conn = get_db_connection()
    cur = conn.cursor()

    # Create users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(200),
            role VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP NULL,
            last_action VARCHAR(50)
        );
    """)

    # Create data table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS data(
            user_id VARCHAR(50) NOT NULL,
            id INT AUTO_INCREMENT PRIMARY KEY,
            s_no INT,
            invoice_no VARCHAR(100) NOT NULL,
            invoice_date DATE,
            item_name VARCHAR(255),
            description TEXT,
            qty INT DEFAULT 1,
            unit_rate DECIMAL(10,2),
            igst DECIMAL(10,2),
            sgst DECIMAL(10,2),
            cgst DECIMAL(10,2),
            total DECIMAL(10,2),
            warranty_details TEXT,
            warranty_end DATE,
            warr_customer_care_no VARCHAR(50),
            contact_person VARCHAR(100),
            company_name VARCHAR(255),
            address TEXT,
            state VARCHAR(100),
            gst_no VARCHAR(50),
            pan_no VARCHAR(50),
            contact_phone VARCHAR(20),
            contact_email VARCHAR(100),
            bank_ac_no VARCHAR(50),
            bank_ifsc VARCHAR(20),
            bank_name VARCHAR(100),
            locked BOOLEAN DEFAULT TRUE,
            doc_filename VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
    """)

    # -------------------------------
    # FIX: CHECK MASTER ROLE (NOT admin)
    # -------------------------------
    cur.execute("SELECT user_id FROM users WHERE role = %s LIMIT 1", ("master",))
    exists = cur.fetchone()

    if exists is None:
        print("Creating master user 'adityamater'...")

        pw = bcrypt.hashpw(b"aditya123", bcrypt.gensalt()).decode('utf-8')

        cur.execute("""
            INSERT INTO users (user_id, password_hash, role)
            VALUES (%s, %s, %s)
        """, ("adityamaster", pw, "master"))

    else:
        print("Master user already exists. Skipping insert.")

    conn.commit()
    cur.close()
    conn.close()


init_database()

import bcrypt

def generate_password_hash(password):
    """
    Generates a bcrypt hashed password for secure storage.
    :param password: Plain text password
    :return: Hashed password string
    """
    salt = bcrypt.gensalt()  # generate a random salt
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')  # convert from bytes to string for DB storage

# canonical fields matching your form inputs
CANONICAL_FIELDS = [
    "user_id",
    "invoice_no",
    "invoice_date",
    "item_name",
    "description",
    "qty",
    "unit_rate",
    "igst",
    "sgst",
    "cgst",
    "total",
    "warranty_details",
    "warranty_end",
    "warranty_cc",
    "contact_person",
    "company_name",
    "address",
    "state",
    "gst_no",
    "pan_no",
    "contact_phone",
    "contact_email",
    "bank_acc",
    "bank_ifsc",
    "bank_name",
    "doc_filename",
    "created_at"
]


# known header variants map (lowercase normalized -> canonical)
HEADER_MAP = {

    # Common fields (top part)
    "invoice_no": "invoice_no",
    "invoice_date": "invoice_date",
    "company_name": "company_name",
    "address": "address",
    "state": "state",
    "gst_no": "gst_no",
    "pan_no": "pan_no",

    # Contact fields
    "contact_person": "contact_person",
    "contact_phone": "contact_phone",
    "contact_mobile": "contact_phone",
    "contact_phone_mobile": "contact_phone",
    "contact_phone___mobile": "contact_phone", 
    "contact_email": "contact_email",

    # Bank fields
    "bank_a_c_no": "bank_acc",
    "bank_ac_no": "bank_acc",
    "bank_ac_number": "bank_acc",
    "bank_ifsc": "bank_ifsc",
    "bank_name": "bank_name",

    # Item table
    "item_name": "item_name",
    "description": "description",
    "qty": "qty",

    # rate / amount
    "rate": "unit_rate",
    "unit_rate": "unit_rate",
    "amount": "total",
    "total": "total",

    # GST
    "gst": "igst",
    "igst": "igst",
    "cgst": "cgst",
    "sgst": "sgst",

    # warranty
    "warranty_details": "warranty_details",
    "warranty_end": "warranty_end",
    "warranty_customer_care": "warranty_cc",
    "warranty_customer_care_no": "warranty_cc",
    "warranty_customer_care_number": "warranty_cc",
}

def normalize_header(h):
    h = str(h).lower()

    # remove symbols
    for sym in [":", "/", ".", "-", "(", ")"]:
        h = h.replace(sym, " ")

    # replace multiple spaces → one
    h = " ".join(h.split())

    # convert spaces → underscore
    h = h.replace(" ", "_")

    return h.strip()


def compress_image(file, max_size_kb=900):
    """Compress JPG/PNG images under target size."""
    try:
        image = Image.open(file.stream)
        buffer = io.BytesIO()

        quality = 85
        image_format = image.format

        while True:
            buffer.seek(0)
            buffer.truncate()
            image.save(buffer, format=image_format, optimize=True, quality=quality)

            size_kb = len(buffer.getvalue()) / 1024
            if size_kb <= max_size_kb or quality < 30:
                break

            quality -= 10  # reduce quality stepwise

        buffer.seek(0)
        return buffer
    except Exception as e:
        print("Image compression error:", e)
        return file.stream  # fallback original
        

def compress_pdf(file, max_size_kb=900):
    """Compress PDF using PyPDF2 (lossless)."""
    try:
        reader = PdfReader(file.stream)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        buffer = io.BytesIO()
        writer.write(buffer)

        # If still bigger than limit → return as-is (lossless only)
        if len(buffer.getvalue()) / 1024 > max_size_kb:
            print("PDF still large, returning lossless result.")
        
        buffer.seek(0)
        return buffer

    except Exception as e:
        print("PDF compression error:", e)
        return file.stream  # fallback original



# -----------------------
# ROUTES
# -----------------------
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('role') == 'admin':
        return redirect(url_for('admin_panel'))
    elif session.get('role') == 'master':
        return redirect(url_for('master_panel'))
    return redirect(url_for('user_panel'))


# ---------- AUTH / LOGIN ----------
@app.route('/login', methods=['GET'])
def login():
    # render your login template (you already have)
    return render_template('login.html')


@app.route('/login_post', methods=['POST'])
def login_post():
    user_id = request.form.get('user_id')
    password = request.form.get('password')
    if not user_id or not password:
        session['flash_message'] = "Missing credentials"
        session['flash_type'] = "danger"
        return redirect(url_for('login'))

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE user_id=%s", (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and user.get('password_hash'):
        # bcrypt stored string value
        if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            session['user_id'] = user['user_id']
            session['role'] = user['role']
            # update last_used
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE users SET last_used_at = NOW() WHERE user_id=%s", (user_id,))
            conn.commit()
            cur.close()
            conn.close()
            if user['role'] == 'admin':
                return redirect(url_for('admin_panel'))
            elif user['role'] == 'master':
                return redirect(url_for('master_panel'))
            else:
                return redirect(url_for('user_panel'))

    session['flash_message'] = "Invalid User ID or Password"
    session['flash_type'] = "danger"
    return redirect(url_for('login'))


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ---------- admin PAGES ----------
@app.route('/admin')
def admin_panel():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login'))
    return render_template('admin.html', admin_user=session.get('user_id'))


@app.route('/admin/invoices')
def admin_invoices_page():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login'))
    return render_template('invoices.html')

@app.route('/api/invoices')
def api_get_invoices():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 403

    # pagination
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    q = request.args.get('q', '').strip()

    offset = (page - 1) * per_page

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # ---------------------------
    # Build WHERE clause cleanly
    # ---------------------------
    where_clauses = ["LOCKED = TRUE"]
    params = []

    if q:
        like = f"%{q}%"
        where_clauses.append("""
            (
                invoice_no LIKE %s OR
                company_name LIKE %s OR
                contact_person LIKE %s OR
                gst_no LIKE %s OR
                state LIKE %s OR
                item_name LIKE %s
            )
        """)
        params.extend([like, like, like, like, like, like])

    where_sql = " AND ".join(where_clauses)

    # ---------------------------
    # Count query (no LIMIT)
    # ---------------------------
    count_sql = f"SELECT COUNT(*) AS c FROM data WHERE {where_sql}"
    cur.execute(count_sql, tuple(params))
    total = cur.fetchone()['c']

    # ---------------------------
    # Data query (with LIMIT)
    # ---------------------------
    data_sql = f"""
        SELECT *
        FROM data
        WHERE {where_sql}
        ORDER BY id DESC
        LIMIT %s OFFSET %s
    """

    cur.execute(data_sql, tuple(params + [per_page, offset]))
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify({'total': total, 'rows': rows})

@app.route('/user/<int:id>')
def user_page(id):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, user_id, role, created_at, last_used_at, last_action FROM users WHERE id=%s", (id,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return render_template('404.html'), 404  # or return "User not found", 404

    # Render a new HTML page that displays the user's info
    return render_template('newinvoices.html', user=user)

@app.route('/get_user_invoice/<string:id>')
def get_user_invoice(id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = id

    # Read pagination inputs
    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
    except:
        page = 1
        per_page = 10

    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # ---- Total Records ----
    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM data
        WHERE user_id = %s AND locked = TRUE
    """, (user_id,))
    
    total_count = cursor.fetchone()['total']

    # ---- Paged Records ----
    cursor.execute("""
        SELECT id, invoice_no, item_name, qty, unit_rate, igst, sgst, cgst, total,
               contact_person, company_name, state, gst_no
        FROM data
        WHERE user_id = %s AND locked = TRUE
        ORDER BY id DESC
        LIMIT %s OFFSET %s
    """, (user_id, per_page, offset))
    
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify({
        "total": total_count,
        "rows": rows
    })


@app.route('/api/invoices/search')
def api_invoices_search():
   
    # --- Get search query ---
    q = request.args.get('q', '').strip()
    if not q or q.lower() == 'undefined':
        q = ''

    # --- Database connection ---
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # --- Base SQL ---
    if q:
        like = f"%{q}%"
        cur.execute("""
            SELECT user_id,invoice_no,invoice_date,item_name,description,qty ,unit_rate,igst,sgst ,cgst,total,warranty_details,warranty_end,
            warr_customer_care_no,contact_person,company_name,address, state,gst_no ,pan_no,contact_phone,contact_email,bank_ac_no,
            bank_ifsc, bank_name ,doc_filename,created_at
            FROM data
            WHERE (user_id LIKE %s
                OR invoice_no LIKE %s
                OR invoice_date LIKE %s
                OR item_name LIKE %s
                OR description LIKE %s
                OR qty LIKE %s
                OR unit_rate LIKE %s
                OR igst LIKE %s
                OR sgst LIKE %s
                OR cgst LIKE %s
                OR total LIKE %s
                OR warranty_details LIKE %s
                OR warranty_end LIKE %s
                OR  warr_customer_care_no LIKE %s
                OR contact_person LIKE %s
                OR company_name LIKE %s
                OR address LIKE %s
                OR state LIKE %s
                OR gst_no LIKE %s
                OR pan_no LIKE %s
                OR contact_phone LIKE %s
                OR contact_email LIKE %s
                OR bank_ac_no LIKE %s
                OR  bank_ifsc LIKE %s
                OR bank_name LIKE %s
                OR doc_filename LIKE %s
                OR created_at LIKE %s)
                AND LOCKED = TRUE
            ORDER BY id DESC
        """, (like, like, like, like, like, like, like, like, like ,like,like,like,like,like,like,like,like,like,like,like,like,like,like,like,like,like,like))
    else:
        cur.execute("""
            SELECT user_id,invoice_no,invoice_date,item_name,description,qty ,unit_rate,igst,sgst ,cgst,total,warranty_details,warranty_end,
            warr_customer_care_no,contact_person,company_name,address, state,gst_no ,pan_no,contact_phone,contact_email,bank_ac_no,
            bank_ifsc, bank_name ,doc_filename,created_at
            FROM data WHERE LOCKED = TRUE
            ORDER BY id DESC
        """)

    # --- Fetch data ---
    rows = cur.fetchall()
    total = len(rows)

    cur.close()
    conn.close()
    # --- Send response ---
    return jsonify({'total': total, 'rows': rows})



# ---------- admin: CREATE USER ----------
@app.route('/admin/create_user', methods=['POST'])
def create_user():
    # Accept both form-data keys: user_id or userid and form OR JSON
    userid = request.form.get('user_id') or request.form.get('userid')
    if not userid:
        try:
            data = request.get_json(silent=True) or {}
            userid = data.get('userid') or data.get('user_id')
            password = data.get('password')
        except Exception:
            userid = None
            password = None
    else:
        password = request.form.get('password')

    # fallback - if JSON with keys 'userid' & 'password' sent
    if not userid:
        jd = request.get_json(silent=True)
        if jd:
            userid = jd.get('userid') or jd.get('user_id')
            password = jd.get('password')

    if not userid or not password:
        return jsonify({"status": "error", "message": "User ID and password required."})

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id FROM users WHERE user_id=%s", (userid,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"status": "error", "message": "User already exists."})

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("INSERT INTO users (user_id, password_hash, role) VALUES (%s,%s,%s)",
                    (userid, hashed_pw, 'user'))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", 
                        "message": f"<p style='color:green; font-weight:bold;'>User '{userid}' created successfully."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route('/api/users/search')
def api_users_search():
    # --- Authorization check ---
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 403

    # --- Get search query ---
    q = request.args.get('q', '').strip()
    if not q or q.lower() == 'undefined':
        q = ''

    # --- Database connection ---
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # --- Base SQL ---
    if q:
        like = f"%{q}%"
        cur.execute("""
            SELECT id, user_id, role, created_at, last_used_at, last_action
            FROM users
            WHERE role != 'admin'
              AND (
                    user_id LIKE %s
                 OR role LIKE %s
                 OR last_action LIKE %s
              )
            ORDER BY id DESC
        """, (like, like, like))
    else:
        cur.execute("""
            SELECT id, user_id, role, created_at, last_used_at, last_action
            FROM users
            WHERE role != 'admin'
            ORDER BY id DESC
        """)

    # --- Fetch data ---
    rows = cur.fetchall()
    total = len(rows)

    cur.close()
    conn.close()
    # --- Send response ---
    return jsonify({'total': total, 'rows': rows})



# ---------- API: list users (exclude admin) ----------
@app.route('/api/users')
def api_users():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id, user_id, role, created_at, last_used_at, last_action
            FROM users
            WHERE role = 'user'
            ORDER BY id DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        for i, r in enumerate(rows, start=1):
            r['s_no'] = i
        return jsonify({"status": "ok", "total": len(rows), "rows": rows})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# ---------- admin: edit user ----------
@app.route('/api/users/<int:user_id>', methods=['GET', 'POST'])
def manage_user(user_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    if request.method == 'GET':
        cur.execute("SELECT id, user_id, role, created_at, last_used_at, last_action FROM users WHERE id=%s", (user_id,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404

        return jsonify({'status': 'ok', 'user': user})

    # POST → update user
    data = request.form if request.form else request.get_json()

    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')

    try:
        if password:
            hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute("""
                UPDATE users
                SET user_id=%s, password_hash=%s, role=%s
                WHERE id=%s
            """, (username, hashed_pw, role, user_id))
        else:
            cur.execute("""
                UPDATE users
                SET user_id=%s, role=%s
                WHERE id=%s
            """, (username, role, user_id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'status': 'ok', 'message': 'User updated successfully'})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})


# ---------- admin: delete user ----------
@app.route('/admin/user/<int:user_id>/delete', methods=['POST'])
def admin_delete_user(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# ---------- CHART count (total vs user) ----------
@app.route('/api/user/<int:user_id>/counts')
def api_user_counts(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        # 1) Get user_id string from users table
        cur.execute("SELECT user_id FROM users WHERE id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"status": "error", "message": "User not found"})

        user_identifier = row["user_id"]

        # 2) Total UNLOCKED invoices
        cur.execute("SELECT COUNT(*) AS total FROM data WHERE locked = FALSE")
        total = cur.fetchone()['total']

        # 3) UNLOCKED invoices created by THIS user
        cur.execute("""
            SELECT COUNT(*) AS user_total
            FROM data
            WHERE user_id=%s AND locked = FALSE
        """, (user_identifier,))
        user_total = cur.fetchone()['user_total']

        cur.close()
        conn.close()

        return jsonify({
            "status": "ok",
            "total_count": total,
            "user_count": user_total
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})
    
#-----------------------------------------------    
#---------------master panel page---------------
#-----------------------------------------------

@app.route('/master')
def master_panel():
    if 'user_id' not in session or session.get('role') != 'master':
        return redirect(url_for('login'))
    return render_template('master.html', master_user=session.get('user_id'))

#-----------------create admin ----------------------

@app.route('/master/create_admin', methods=['POST'])
def create_admin():
    data = request.get_json(silent=True) or request.form

    userid = data.get("userid") or data.get("user_id")
    password = data.get("password")

    if not userid or not password:
        return jsonify({"status": "error", "message": "User ID and password required."})

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        # Check duplicate
        cur.execute("SELECT id FROM users WHERE user_id=%s", (userid,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"status": "error", "message": "User already exists."})

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'),
                                  bcrypt.gensalt()).decode('utf-8')

        cur.execute("""
            INSERT INTO users (user_id, password_hash, role)
            VALUES (%s, %s, %s)
        """, (userid, hashed_pw, 'admin'))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "status": "success",
            "message": f"User '{userid}' created successfully."
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


#----------------fatch all admins-------------------------------

@app.route('/master/get_admins')
def get_admins():
    if 'user_id' not in session or session.get('role') != 'master':
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT user_id, created_at FROM users WHERE role='admin'")
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify({"admins": rows})

#-------------delete admin----------------

@app.route('/master/delete_admin', methods=['POST'])
def delete_admin():
    if 'user_id' not in session or session.get('role') != 'master':
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    data = request.get_json()
    userid = data.get("userid")

    if not userid:
        return jsonify({"status": "error", "message": "User ID required"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM users WHERE user_id=%s AND role='admin'", (userid,))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"status": "success", "message": f"Deleted '{userid}'"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})
    
#------------------------------------------
#-------------company page ----------------
#------------------------------------------

@app.route('/admin/company')
def admin_company_page():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect(url_for('login'))
    return render_template('company.html')

@app.route('/api/company_list')
def api_company_list():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT 
            company_name AS name,
            address,
            state,
            contact_phone AS contact
        FROM data
        GROUP BY company_name, address, state, contact_phone
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify({"status": "ok", "companies": rows})


@app.route('/api/company_search')
def api_company_search():
    q = request.args.get("q", "").strip().lower()

    if q == "":
        return jsonify({"status": "error", "message": "Query required"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        like = f"%{q}%"

        cur.execute("""
            SELECT 
                company_name AS name,
                address,
                state,
                contact_phone AS contact
            FROM data
            WHERE 
                LOWER(company_name) LIKE %s OR
                LOWER(address) LIKE %s OR
                LOWER(state) LIKE %s OR
                LOWER(contact_phone) LIKE %s
            GROUP BY company_name, address, state, contact_phone
            ORDER BY company_name ASC
        """, (like, like, like, like))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({"status": "ok", "companies": rows})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


#--------------------------------------
# ---------- USER PANEL page ----------
#--------------------------------------

@app.route('/user_panel')
def user_panel():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('user_panel.html', user=session.get('user_id'))



# date converter helper function---------------

def convert_to_mysql_date(value):
    """Convert Excel/Python/string date to MySQL YYYY-MM-DD format."""
    if pd.isna(value) or value == "":
        return ""

    # Case 1: Already a Python datetime
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    # Case 2: Excel numeric serial date
    if isinstance(value, (int, float)):
        try:
            excel_origin = datetime(1899, 12, 30)
            return (excel_origin + pd.to_timedelta(value, 'D')).strftime("%Y-%m-%d")
        except:
            pass

    # Case 3: String formats
    value = str(value).strip()

    possible_formats = [
        "%a, %d %b %Y %H:%M:%S %Z",   # Fri, 18 Jul 2003 00:00:00 GMT
        "%d/%m/%Y",                   # 18/07/2003
        "%Y-%m-%d",                   # 2003-07-18
        "%d-%m-%Y",                   # 18-07-2003
        "%m/%d/%Y",                   # 07/18/2003
    ]

    for fmt in possible_formats:
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except:
            continue

    return ""  # fallback if no format matches




#----------------map the data -------------------------
@app.route('/upload_excel', methods=['POST'])
def upload_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']

    try:
        df = pd.read_excel(file, header=None, engine='openpyxl')

        # Clean NaN
        clean = lambda v: "" if pd.isna(v) else v

        # Normalize headers
        def norm(h):
            h = str(h).lower()
            for s in [":", "/", ".", "-", "(", ")"]:
                h = h.replace(s, " ")
            return " ".join(h.split()).replace(" ", "_")

        # Header mapping for frontend field ids
        HEADER_MAP = {
            "s_no": "s_no",
            "invoice_no": "invoice_no",
            "invoice_date": "invoice_date",
            "item_name": "item_name",
            "description": "description",
            "qty": "qty",
            "unit_rate": "unit_rate",
            "gst": "igst",
            "gst%": "igst",
            "total": "total",
            "warranty_details": "warranty_details",
            "warranty_end_date": "warranty_end",
            "warranty_customer_care_no": "warranty_cc",

            # Common fields
            "company_name": "company_name",
            "address": "address",
            "state": "state",
            "gst_no": "gst_no",
            "pan_no": "pan_no",
            "contact_phone_mobile": "contact_phone",
            "contact_email": "contact_email",
            "bank_a_c_no": "bank_acc",
            "bank_ifsc": "bank_ifsc",
            "bank_name": "bank_name",
            "contact_person": "contact_person",
        }

        # ---------------------
        # 1️⃣ COMMON FIELDS
        # ---------------------
        common = {}

        for i in range(0, 11):  # rows 0–10
            key = df.iloc[i, 0]
            val = df.iloc[i, 1]
            canon = HEADER_MAP.get(norm(key), norm(key))
            common[canon] = clean(val)

        # ---------------------
        # 2️⃣ ITEM TABLE
        # ---------------------
        HEADER_ROW = 12
        df_items = pd.read_excel(file, header=HEADER_ROW, engine='openpyxl')

        # Detect correct Item Name column
        item_col = None
        for col in df_items.columns:
            if "item" in norm(col):
                item_col = col
                break

        if not item_col:
            return jsonify({"error": "Item Name column missing"}), 400

        # Drop empty rows
        df_items = df_items[df_items[item_col].notna()]

        final_rows = []

        # ---------------------
        # 3️⃣ BUILD ROWS
        # ---------------------
        for _, row in df_items.iterrows():
            r = {}

            # Add common fields
            for k, v in common.items():
                r[k] = clean(v)

            # Add item fields
            for col in df_items.columns:
                canon = HEADER_MAP.get(norm(col), norm(col))
                r[canon] = clean(row[col])

            # Fix date
            try:
                r["invoice_date"] = convert_to_mysql_date(r["invoice_date"])
            except:
                pass

            # GST split logic
            gst = float(r.get("igst", 0) or 0)
            state = str(r.get("state", "")).lower()

            if state in ["up", "uttar pradesh", "uttarpradesh"]:
                r["igst"] = gst
                r["cgst"] = 0
                r["sgst"] = 0
            else:
                r["igst"] = 0
                r["cgst"] = gst / 2
                r["sgst"] = gst / 2

            final_rows.append(r)

        return jsonify({"rows": final_rows, "total_rows": len(final_rows)})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------- SAVE invoice (user) ----------

def clean_date(x):
    if not x or str(x).strip() == "":
        return None
    try:
        d = parser.parse(str(x))
        return d.strftime("%Y-%m-%d")
    except:
        return None
    
    
def safe(val):
    if val is None:
        return None
    if val == "" or val == "NaN":
        return None
    return val



@app.route('/save_rows', methods=['POST'])
def save_rows():
    data = request.get_json()
    rows = data["rows"]

    user_id = session.get("user_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    row_ids = []

    for row in rows:
        cursor.execute("""
            INSERT INTO data (
                user_id,
                s_no,
                invoice_no,
                invoice_date,
                item_name,
                description,
                qty,
                unit_rate,
                igst,
                sgst,
                cgst,
                total,
                warranty_details,
                warranty_end,
                warr_customer_care_no,
                contact_person,
                company_name,
                address,
                state,
                gst_no,
                pan_no,
                contact_phone,
                contact_email,
                bank_ac_no,
                bank_ifsc,
                bank_name,
                locked,
                doc_filename
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
        """, (
            user_id,
            safe(row.get("s_no")),
            safe(row.get("invoice_no")),
            clean_date(row.get("invoice_date")),
            safe(row.get("item_name")),
            safe(row.get("description")),
            int(row.get("qty") or 1),
            float(row.get("unit_rate") or 0),
            float(row.get("igst") or 0),
            float(row.get("sgst") or 0),
            float(row.get("cgst") or 0),
            float(row.get("total") or 0),
            safe(row.get("warranty_details")),
            clean_date(row.get("warranty_end")),
            safe(row.get("warr_customer_cc")),
            safe(row.get("contact_person")),
            safe(row.get("company_name")),
            safe(row.get("address")),
            safe(row.get("state")),
            safe(row.get("gst_no")),
            safe(row.get("pan_no")),
            safe(row.get("contact_phone")),
            safe(row.get("contact_email")),
            safe(row.get("bank_acc")),
            safe(row.get("bank_ifsc")),
            safe(row.get("bank_name")),
            True,          # locked by default
            None           # doc_filename will be updated later
        ))


        row_ids.append(cursor.lastrowid)

    conn.commit()
    
     # 📝 Update user activity
    cursor.execute("""
        UPDATE users 
        SET last_action = %s,
            last_used_at = NOW()
        WHERE user_id = %s
    """, ("envoice added", user_id))
    conn.commit()
    
    cursor.close()
    conn.close()

    return jsonify({"row_ids": row_ids})


@app.route('/upload_doc', methods=['POST'])
def upload_doc():
    file = request.files["file"]
    row_id = request.form["row_id"]

    ext = file.filename.lower()

    # compress
    if ext.endswith(".jpg") or ext.endswith(".jpeg") or ext.endswith(".png"):
        stream = compress_image(file)
    elif ext.endswith(".pdf"):
        stream = compress_pdf(file)
    else:
        stream = file.stream

    filename = f"{row_id}_{file.filename}"
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    # save compressed file
    with open(path, "wb") as f:
        f.write(stream.read())

    # update DB
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("UPDATE data SET doc_filename=%s WHERE id=%s", (filename, row_id))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"status": True})



@app.route('/get_user_records')
def get_user_records():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, invoice_no, item_name, qty, unit_rate, igst, sgst, cgst, total,
               company_name, state, warranty_end, warranty_details
        FROM data
        WHERE user_id = %s
        AND locked = TRUE
    """, (user_id,))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify({
        "total": len(rows),   # 🔥 record count
        "rows": rows          # 🔥 actual data
    })

@app.route('/api/invoices')
def api_invoices():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 403

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    q = request.args.get('q', '').strip()

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # -----------------------
    # Build base WHERE clause
    # -----------------------
    where = "WHERE LOCKED = TRUE"
    params = []

    if q:
        where += " AND (invoice_no LIKE %s OR item_name LIKE %s OR company_name LIKE %s)"
        like = f"%{q}%"
        params.extend([like, like, like])

    # -----------------------
    # Count Query (NO LIMIT!)
    # -----------------------
    count_sql = f"SELECT COUNT(*) AS cnt FROM data {where}"
    cur.execute(count_sql, tuple(params))
    total = cur.fetchone()['cnt']

    # -----------------------
    # Data Query with LIMIT
    # -----------------------
    offset = (page - 1) * per_page
    data_sql = f"""
        SELECT *
        FROM data
        {where}
        ORDER BY id DESC
        LIMIT %s OFFSET %s
    """

    data_params = params + [per_page, offset]
    cur.execute(data_sql, tuple(data_params))
    rows = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify({'total': total, 'rows': rows})


@app.route('/api/invoice/<int:id>')
def api_invoice(id):
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM data WHERE id=%s AND LOCKED = TRUE", (id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({'error': 'Invoice not found'})

    return jsonify(row)




@app.route('/delete_invoice/<int:id>', methods=['DELETE'])
def delete_invoice(id):
    try:
        if 'user_id' not in session:
            return jsonify({"success": False, "error": "Unauthorized"}), 401

        user_id = session['user_id']

        conn = get_db_connection()
        cursor = conn.cursor()

        # 📌 Check if record exists and belongs to user
        cursor.execute("SELECT id FROM data WHERE id = %s AND user_id = %s", (id, user_id))
        record = cursor.fetchone()

        if not record:
            return jsonify({"success": False, "error": "Record not found or not allowed"}), 404

        # 🧹 Soft delete (only unlock/hide)
        cursor.execute("""
            UPDATE data
            SET locked = 0
            WHERE id = %s AND user_id = %s
        """, (id, user_id))
        conn.commit()

        # 📝 Update user activity
        cursor.execute("""
            UPDATE users 
            SET last_action = %s,
                last_used_at = NOW()
            WHERE user_id = %s
        """, ("Deleted invoice", user_id))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"success": True}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/get_locked_records/<string:user_id>')
def get_locked_records(user_id):

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, invoice_no, gst_no, invoice_date, contact_person,
               state, contact_phone, contact_email
        FROM data
        WHERE user_id = %s
        AND locked = FALSE
    """, (user_id,))

    rows = cursor.fetchall()
    return jsonify(rows)

@app.route('/get_locked_record')
def get_locked_record():

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, invoice_no, gst_no, invoice_date, contact_person,
               state, contact_phone, contact_email
        FROM data
        where locked = FALSE
    """)

    rows = cursor.fetchall()
    return jsonify(rows)

@app.route('/unlock_invoice/<int:id>', methods=['POST'])
def unlock_invoice(id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Fetch user_id for logging activity
    cursor.execute("SELECT user_id FROM data WHERE id=%s", (id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Invoice not found"}), 404

    user_id = row["user_id"]

    # Unlock invoice
    cursor.execute("""
        UPDATE data
        SET locked = TRUE
        WHERE id = %s
    """, (id,))

    # 🔥 Save user activity log
    cursor.execute("""
        UPDATE users SET last_action=%s, last_used_at=NOW()
        WHERE user_id=%s
    """, ("invoice recovered", user_id))

    conn.commit()
    conn.close()

    return jsonify({"success": True})

#--------------user invoice edit -------------------

@app.route('/get_invoice/<int:id>', methods=['GET'])
def get_invoice(id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM data WHERE id = %s", (id,))
    row = cursor.fetchone()

    conn.close()
    
    if not row:
        return jsonify({"error": "data not found"}), 404

    return jsonify(row)


@app.route("/edit_invoice/<int:id>", methods=["POST"])
def edit_invoice(id):

    data = request.form
    file = request.files.get("document")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Fetch user_id and old file name
    cursor.execute("SELECT user_id, doc_filename FROM data WHERE id=%s", (id,))
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Invoice not found"}), 404

    user_id = row["user_id"]
    old_file = row["doc_filename"]
    new_filename = old_file

    # --------------------------
    # FILE HANDLING
    # --------------------------
    if file:
        ext = file.filename.split(".")[-1]
        new_filename = f"invoice_{id}.{ext}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], new_filename)

        file.save(file_path)

        # remove old file
        if old_file and old_file != new_filename:
            old_path = os.path.join(app.config["UPLOAD_FOLDER"], old_file)
            if os.path.exists(old_path):
                os.remove(old_path)

        cursor.execute("UPDATE data SET doc_filename=%s WHERE id=%s", (new_filename, id))

    # --------------------------
    # DATE CLEANING
    # --------------------------
    invoice_date = clean_date(data.get("invoice_date"))
    warranty_end = clean_date(data.get("warranty_end"))

    # --------------------------
    # UPDATE INVOICE
    # --------------------------
    cursor.execute("""
        UPDATE data SET
            invoice_no=%s,
            item_name=%s,
            qty=%s,
            unit_rate=%s,
            igst=%s,
            cgst=%s,
            sgst=%s,
            total=%s,
            contact_person=%s,
            company_name=%s,
            state=%s,
            gst_no=%s,
            invoice_date=%s,
            description=%s,
            warranty_details=%s,
            warranty_end=%s,
            warr_customer_care_no=%s,
            address=%s,
            pan_no=%s,
            contact_phone=%s,
            contact_email=%s,
            bank_ac_no=%s,
            bank_ifsc=%s,
            bank_name=%s
        WHERE id=%s
    """, (
        data.get("invoice_no"),
        data.get("item_name"),
        data.get("qty"),
        data.get("unit_rate"),
        data.get("igst"),
        data.get("cgst"),
        data.get("sgst"),
        data.get("total"),
        data.get("contact_person"),
        data.get("company_name"),
        data.get("state"),
        data.get("gst_no"),
        invoice_date,           # <--- NOW CLEAN DATE
        data.get("description"),
        data.get("warranty_details"),
        warranty_end,           # <--- NOW CLEAN DATE
        data.get("warr_customer_care_no"),
        data.get("address"),
        data.get("pan_no"),
        data.get("contact_phone"),
        data.get("contact_email"),
        data.get("bank_ac_no"),
        data.get("bank_ifsc"),
        data.get("bank_name"),
        id
    ))

    # Log action (optional)
    cursor.execute("""
        UPDATE users SET last_action=%s, last_used_at=NOW()
        WHERE user_id=%s
    """, ("invoice edited", user_id))

    conn.commit()
    conn.close()

    return jsonify({"success": True})

#-----------------------full exal --------------------------

@app.route('/export_all', methods=['GET'])
def export_all():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        # Correct column names based on your DB table
        query = """
            SELECT 
                user_id,
                invoice_no,
                invoice_date,
                item_name,
                description,
                qty,
                unit_rate,
                igst,
                sgst,
                cgst,
                total,
                warranty_details,
                warranty_end,
                warr_customer_care_no,
                contact_person,
                company_name,
                address,
                state,
                gst_no,
                pan_no,
                contact_phone,
                contact_email,
                bank_ac_no,
                bank_ifsc,
                bank_name,
                doc_filename
            FROM data
            WHERE locked = 1
        """

        cur.execute(query)
        rows = cur.fetchall()

        cur.close()
        conn.close()

        if not rows:
            return "No data available", 404

        # Convert to DataFrame
        df = pd.DataFrame(rows)

        # Create Excel in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='All_Data')

        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name='all_data.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        print("Export error:", str(e))
        return "Error generating Excel", 500

#---------------costum exal -------------------------

@app.route('/get_export_invoices')
def get_export_invoices():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT 
            id,
            invoice_no,
            company_name,
            item_name,
            gst_no
        FROM data
        WHERE locked = 1
        ORDER BY id DESC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(rows)


@app.route('/export_custom', methods=['POST'])
def export_custom():
    try:
        data = request.json
        ids = data.get('ids', [])

        if not ids:
            return "No invoices selected", 400

        placeholders = ",".join(["%s"] * len(ids))

        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        query = f"""
        SELECT 
            user_id,
            invoice_no,
            invoice_date,
            item_name,
            description,
            qty,
            unit_rate,
            igst,
            sgst,
            cgst,
            total,
            warranty_details,
            warranty_end,
            warr_customer_care_no,
            contact_person,
            company_name,
            address,
            state,
            gst_no,
            pan_no,
            contact_phone,
            contact_email,
            bank_ac_no,
            bank_ifsc,
            bank_name,
            doc_filename
        FROM data
        WHERE locked = 1
        AND id IN ({placeholders})
        ORDER BY id ASC
        """

        cur.execute(query, tuple(ids))
        rows = cur.fetchall()

        cur.close()
        conn.close()

        if not rows:
            return "No data", 404

        df = pd.DataFrame(rows)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="SelectedInvoices")

        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name="custom_invoices.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception as e:
        print(e)
        return "Error", 500


#-----------------see daucument -----------------------

@app.route('/invoice_doc/<int:id>')
def invoice_doc(id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT doc_filename FROM data WHERE id=%s", (id,))
    doc = cursor.fetchone()

    cursor.close()
    conn.close()

    if not doc or not doc['doc_filename']:
        return "Document not found", 404

    return send_from_directory(app.config['UPLOAD_FOLDER'], doc['doc_filename'])


   
if __name__ == "__main__":
    app.run(debug=True)