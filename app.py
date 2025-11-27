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





app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")  # change to a secure key in production

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

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50)  UNIQUE NOT NULL,
            password_hash VARCHAR(200),
            role VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP NULL,
            last_action varchar(50)
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS data(
            user_id VARCHAR(50) NOT NULL,
            id INT AUTO_INCREMENT PRIMARY KEY,
            s_no INT,
            invoice_no VARCHAR(100) NOT NULL UNIQUE,
            invoice_date DATE,
            item_name VARCHAR(255) ,
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
            contact_person VARCHAR(100) NOT NULL,
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
            doc_filename VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
    """)

    # ensure master user exists
    cur.execute("SELECT user_id FROM users WHERE role='master' LIMIT 1;")
    if cur.fetchone() is None:
        pw = bcrypt.hashpw(b"aditya123", bcrypt.gensalt())
        cur.execute("INSERT INTO users (user_id, password_hash, role) VALUES (%s,%s,%s)",
                    ("adityamaster", pw.decode('utf-8'), "master"))

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
    "s no": "s_no",
    "invoice no": "invoice_no",
    "invoice date": "invoice_date",
    "item name": "item_name",
    "description": "description",
    "qty": "qty",
    "unit rate": "unit_rate",
    "gst": "igst",   # GST amount column
    "total": "total",
    "warranty details": "warranty_details",
    "warranty end": "warranty_end",
    "warranty customer care": "warranty_cc",
    "contact person": "contact_person",
    "company name": "company_name",
    "address": "address",
    "state": "state",
    "gst no": "gst_no",
    "pan no": "pan_no",
    "contact phone": "contact_phone",
    "contact email": "contact_email",
    "bank a c no": "bank_acc",
    "bank ifsc": "bank_ifsc",
    "bank name": "bank_name"
}


def normalize_header(h):
    return (
        str(h)
        .lower()
        .replace(":", "")
        .replace("/", " ")
        .replace(".", "")
        .replace("_", " ")
        .strip()
    )

# -----------------------
# ROUTES
# -----------------------
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('role') == 'master':
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
            if user['role'] == 'master':
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


# ---------- MASTER PAGES ----------
@app.route('/master')
def master_panel():
    if 'user_id' not in session or session.get('role') != 'master':
        return redirect(url_for('login'))
    return render_template('master.html', master_user=session.get('user_id'))


@app.route('/master/invoices')
def master_invoices_page():
    if 'user_id' not in session or session.get('role') != 'master':
        return redirect(url_for('login'))
    return render_template('invoices.html')

@app.route('/api/invoices')
def api_get_invoices():
    if 'user_id' not in session or session.get('role') != 'master':
        return jsonify({'error': 'unauthorized'}), 403

    # pagination params
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    q = request.args.get('q', '').strip()

    offset = (page - 1) * per_page

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    # base query
    base_query = "SELECT * FROM data WHERE LOCKED = TRUE"
    params = []

    # search filter
    if q:
        like = f"%{q}%"
        base_query += """ WHERE 
            invoice_no LIKE %s OR 
            company_name LIKE %s OR 
            contact_person LIKE %s OR
            gst_no LIKE %s OR
            state LIKE %s OR
            item_name LIKE %s
        """
        params = [like, like, like, like, like, like]

    # total count
    cur.execute(base_query.replace("SELECT *", "SELECT COUNT(*) AS c"), params)
    total = cur.fetchone()['c']

    # actual data query
    base_query += " ORDER BY id DESC LIMIT %s OFFSET %s"
    params.extend([per_page, offset])
    cur.execute(base_query, params)

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

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # ✅ use dictionary cursor

    cursor.execute("""
        SELECT id, invoice_no, item_name, qty, unit_rate,igst,sgst, cgst, total,
               contact_person, company_name, state, gst_no
        FROM data
        WHERE user_id = %s
       AND locked = TRUE
    """, (user_id,))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()
    # ✅ rows is already a list of dictionaries — no need for dict(row)
    return jsonify(rows)

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



# ---------- MASTER: CREATE USER ----------
@app.route('/master/create_user', methods=['POST'])
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
    if 'user_id' not in session or session.get('role') != 'master':
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
            WHERE role != 'master'
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
            WHERE role != 'master'
            ORDER BY id DESC
        """)

    # --- Fetch data ---
    rows = cur.fetchall()
    total = len(rows)

    cur.close()
    conn.close()
    # --- Send response ---
    return jsonify({'total': total, 'rows': rows})



# ---------- API: list users (exclude master) ----------
@app.route('/api/users')
def api_users():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT id, user_id, role, created_at, last_used_at, last_action
            FROM users
            WHERE role != 'master'
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


# ---------- MASTER: edit user ----------
@app.route('/api/users/<int:user_id>', methods=['GET', 'POST'])
def manage_user(user_id):
    if 'user_id' not in session or session.get('role') != 'master':
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


# ---------- MASTER: delete user ----------
@app.route('/master/user/<int:user_id>/delete', methods=['POST'])
def master_delete_user(user_id):
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
    # master sends user id (int). Convert to user_id string, then count data rows where contact_person = user_id string.
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT user_id FROM users WHERE id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return jsonify({"status": "error", "message": "User not found"})
        user_identifier = row['user_id']

        cur.execute("SELECT COUNT(*) AS total FROM data WHERE LOCKED = TRUE")
        total = cur.fetchone()['total'] or 0

        cur.execute("SELECT COUNT(*) AS user_total FROM data WHERE contact_person=%s AND LOCKED = TRUE", (user_identifier,))
        user_total = cur.fetchone()['user_total'] or 0

        cur.close()
        conn.close()

        return jsonify({"status": "ok", "total_count": total, "user_count": user_total})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# ---------- USER PANEL page ----------
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
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        df = pd.read_excel(file, header=None, engine='openpyxl')

        if df.shape[1] < 2:
            return jsonify({'error': 'Invalid Excel format'}), 400

        label_col = df.iloc[:, 0].astype(str).str.strip()
        value_col = df.iloc[:, 1]

        # Normalize labels
        norm_labels = [normalize_header(c) for c in label_col]

        # Build mapping from normalized label to value
        excel_map = {
            HEADER_MAP.get(lbl, lbl): val
            for lbl, val in zip(norm_labels, value_col)}

        mapped = {}

        # Fill canonical fields
        for canon in CANONICAL_FIELDS:
            val = excel_map.get(canon, "")

            # Convert date fields
            if canon in ["invoice_date", "warranty_end", "warranty_start"]:
                val = convert_to_mysql_date(val)

            mapped[canon] = val

        # -------------------------------------------------------
        #                ⭐ ADD GST LOGIC HERE ⭐
        # -------------------------------------------------------

        # GST LOGIC
        state = str(mapped.get("state", "")).strip().lower()

        gst_value = mapped.get("igst", "")
        try:
            gst_value = float(gst_value) if gst_value else 0
        except:
            gst_value = 0

        # If UP → full GST in IGST
        if state in ["up", "uttar pradesh", "uttarpradesh"]:
            mapped["igst"] = gst_value
            mapped["sgst"] = 0
            mapped["cgst"] = 0
        else:
            # Other states → split
            mapped["igst"] = 0
            mapped["sgst"] = gst_value / 2
            mapped["cgst"] = gst_value / 2
        # -------------------------------------------------------
        return jsonify({
            'mapped': mapped,
            'sample_rows': df.head(10).to_dict(orient='records')
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ---------- SAVE invoice (user) ----------
@app.route('/save', methods=['POST'])
def save_data():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON received"}), 400

        user_id = session['user_id']

        conn = get_db_connection()
        cursor = conn.cursor()

        # ⭐ Check duplicate invoice
        cursor.execute("""
            SELECT COUNT(*) FROM data
            WHERE invoice_no=%s AND user_id=%s
        """, (data.get('invoice_no'), user_id))
        (count,) = cursor.fetchone()

        if count > 0:
            return jsonify({"error": "Invoice number already exists"}), 409

        # ⭐ Insert new data
        insert_query = """
            INSERT INTO data (
                user_id, s_no, invoice_no, invoice_date, item_name, description,
                qty, unit_rate, igst, sgst, cgst, total,
                warranty_details, warranty_end, warr_customer_care_no,
                contact_person, company_name, address, state, gst_no,
                pan_no, contact_phone, contact_email,
                bank_ac_no, bank_ifsc, bank_name, doc_filename
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            user_id,
            data.get('s_no'), data.get('invoice_no'), data.get('invoice_date'),
            data.get('item_name'), data.get('description'),
            data.get('qty'), data.get('unit_rate'), data.get('igst'),
            data.get('sgst'), data.get('cgst'), data.get('total'),
            data.get('warranty_details'), data.get('warranty_end'),
            data.get('warr_customer_care_no'), data.get('contact_person'),
            data.get('company_name'), data.get('address'), data.get('state'),
            data.get('gst_no'), data.get('pan_no'), data.get('contact_phone'),
            data.get('contact_email'), data.get('bank_ac_no'),
            data.get('bank_ifsc'), data.get('bank_name'),
            data.get('doc_filename')
        )

        cursor.execute(insert_query, values)
        conn.commit()

        # ⭐ Update last action & time
        cursor.execute("""
            UPDATE users
            SET last_action = %s,
                last_used_at = NOW()
            WHERE user_id = %s
        """, ("Added new invoice", user_id))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "Data saved successfully!"}), 200

    except mysql.connector.IntegrityError as e:
        return jsonify({"error": f"Database integrity error: {str(e)}"}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    
@app.route('/get_user_records')
def get_user_records():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_id = session['user_id']

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # ✅ use dictionary cursor

    cursor.execute("""
        SELECT id ,invoice_no, item_name, qty, unit_rate,igst,sgst, cgst, total,
               contact_person, company_name, state, gst_no
        FROM data
        WHERE user_id = %s
        and locked = true
    """, (user_id,))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()
    # ✅ rows is already a list of dictionaries — no need for dict(row)
    return jsonify(rows)


@app.route('/api/invoices')
def api_invoices():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 403

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    q = request.args.get('q', '').strip()

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    base_query = "SELECT * FROM data WHERE 1=1 AND LOCKED = TRUE"
    params = []

    if q:
        base_query += " AND (invoice_no LIKE %s OR item_name LIKE %s OR company_name LIKE %s)"
        qlike = f"%{q}%"
        params += [qlike, qlike, qlike]

    # Count total
    cur.execute(f"SELECT COUNT(*) AS cnt FROM ({base_query}) AS sub", params)
    total = cur.fetchone()['cnt']

    # Pagination
    offset = (page - 1) * per_page
    base_query += " ORDER BY id DESC LIMIT %s OFFSET %s"
    params += [per_page, offset]
    cur.execute(base_query, params)
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

#--------------get doc ------------------------------------


@app.route('/invoice/doc/<int:id>')
def invoice_doc(id):
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT doc_filename FROM data WHERE id=%s", (id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row or not row['doc_filename']:
        return "Document not found", 404

    path = os.path.join(app.config['UPLOAD_FOLDER'], row['doc_filename'])
    if not os.path.exists(path):
        return "File missing on server", 404

    return send_file(path)


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
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE data
        SET locked = TRUE
        WHERE id = %s
    """, (id,))
    
    conn.commit()
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
    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor()

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
            warr_customer_care_no=%s,   -- FIXED
            address=%s,
            pan_no=%s,
            contact_phone=%s,
            contact_email=%s,
            bank_ac_no=%s,               -- FIXED
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
        data.get("invoice_date"),
        data.get("description"),
        data.get("warranty_details"),
        data.get("warranty_end"),
        data.get("warr_customer_care_no"),   # FIXED
        data.get("address"),
        data.get("pan_no"),
        data.get("contact_phone"),
        data.get("contact_email"),
        data.get("bank_ac_no"),              # FIXED
        data.get("bank_ifsc"),
        data.get("bank_name"),
        id
    ))

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

@app.route('/export_custom', methods=['POST'])
def export_custom():
    try:
        data = request.json
        start_id = data.get('start')
        end_id = data.get('end')

        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

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
        WHERE locked = 1 AND id BETWEEN %s AND %s
        ORDER BY id ASC
        """

        cur.execute(query, (start_id, end_id))
        rows = cur.fetchall()

        cur.close()
        conn.close()

        if not rows:
            return "No data", 404

        df = pd.DataFrame(rows)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="CustomData")

        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name="custom_data.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception:
        return "Error", 500

   
if __name__ == "__main__":
    app.run(debug=True)