from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
import bcrypt
from config.database import get_connection

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()
    phone = data.get('phone') or ''

    if not email or not password or not full_name:
        return jsonify({"error": "email, password and full_name are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_connection()
    try:
        existing = conn.execute("SELECT user_id FROM Users WHERE email = ?", (email,)).fetchone()
        if existing:
            return jsonify({"error": "Email already registered"}), 400

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        cur = conn.execute(
            "INSERT INTO Users (email, password_hash, full_name, phone) VALUES (?, ?, ?, ?)",
            (email, password_hash, full_name, phone)
        )
        conn.commit()
        user_id = cur.lastrowid

        token = create_access_token(identity=str(user_id))
        return jsonify({
            "message": "User registered successfully",
            "token": token,
            "user": {"userId": user_id, "email": email, "full_name": full_name}
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500
    finally:
        conn.close()


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    conn = get_connection()
    try:
        user = conn.execute("SELECT * FROM Users WHERE email = ?", (email,)).fetchone()
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401

        if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
            return jsonify({"error": "Invalid credentials"}), 401

        token = create_access_token(identity=str(user['user_id']))
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {"userId": user['user_id'], "email": user['email'], "full_name": user['full_name']}
        })
    finally:
        conn.close()
