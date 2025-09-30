import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
from devices import list_devices
from secure_backup import encrypt_backup_and_wipe, decrypt_and_restore
from secure_encrypt_wipe import encrypt_and_wipe, _pick_disk_by_name_or_size
from user_storage import init_db, insert_user, get_user_by_username

# Devices API (port 9758)
devices_app = Flask("devices_api")
CORS(devices_app, resources={r"/api/*": {"origins": "*"}})

@devices_app.get("/api/devices")
def get_devices():
    devices = list_devices()
    return jsonify(devices), 200


# Encrypt-and-Wipe API (port 6539)
wipe_app = Flask("wipe_api")
CORS(wipe_app, resources={r"/api/*": {"origins": "*"}})

@wipe_app.post("/api/encrypt-and-wipe")
def post_encrypt_and_wipe():
    try:
        body = request.get_json(silent=True) or {}
        device_name = body.get("device")
        if not device_name:
            return jsonify({"status": "error", "message": "Missing 'device' in request body"}), 400

        # New behavior: backup-encrypt files, save key to txt, delete originals
        ok, msg = encrypt_backup_and_wipe(device_name)
        if ok:
            return jsonify({"status": "success", "message": msg}), 200
        else:
            return jsonify({"status": "error", "message": msg}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _run_devices():
    devices_app.run(host="0.0.0.0", port=9758, use_reloader=False)


def _run_wipe():
    wipe_app.run(host="0.0.0.0", port=6539, use_reloader=False)


# Decrypt-and-Restore API (port 9579)
decrypt_app = Flask("decrypt_api")
CORS(decrypt_app, resources={r"/api/*": {"origins": "*"}})

@decrypt_app.post("/api/decrypt-and-restore")
def post_decrypt_and_restore():
    try:
        body = request.get_json(silent=True) or {}
        device_name = body.get("device")
        key_hex = body.get("decryptionKey")
        if not device_name or not key_hex:
            return jsonify({"status": "error", "message": "Missing 'device' or 'decryptionKey'"}), 400
        ok, msg = decrypt_and_restore(device_name, key_hex)
        if ok:
            return jsonify({"status": "success", "message": msg}), 200
        else:
            return jsonify({"status": "error", "message": msg}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _run_decrypt():
    decrypt_app.run(host="0.0.0.0", port=9579, use_reloader=False)


# Wipe method selection API (port 8743)
wipe_method_app = Flask("wipe_method_api")
CORS(wipe_method_app)

@wipe_method_app.post("/get_wipe_method")
def post_get_wipe_method():
    try:
        body = request.get_json(silent=True) or {}
        device_name = (body.get("device") or "").strip()
        if not device_name:
            return jsonify({"error": "Missing 'device' in request body"}), 400

        # Default
        method = "dod"

        # Heuristic 1: keyword-based hint that it's a USB pendrive
        name_l = device_name.lower()
        keywords = ["usb", "pen drive", "pendrive", "flash", "stick", "v220w", "hp"]
        if any(k in name_l for k in keywords):
            method = "boom-wipe"  # Changed from encrypt-and-wipe to boom-wipe
        else:
            # Heuristic 2: resolve disk and check BusType
            try:
                disk = _pick_disk_by_name_or_size(device_name)
                if disk and str(disk.get("BusType", "")).upper() == "USB":
                    method = "boom-wipe"  # Changed from encrypt-and-wipe to boom-wipe
            except Exception:
                pass

        return jsonify({"method": method}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _run_wipe_method():
    # Bind to localhost as requested
    wipe_method_app.run(host="127.0.0.1", port=8743, use_reloader=False)


# Login storage API (port 9574)
login_app = Flask("login_storage_api")

@login_app.post("/loginStorage")
def post_login_storage():
    try:
        if request.headers.get("Content-Type", "").lower() != "application/json":
            return jsonify({"status": "error", "message": "Invalid Content-Type; expected application/json"}), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"status": "error", "message": "Invalid JSON body"}), 400
        # Validate minimal required field
        username = (body.get("username") or "").strip()
        if not username:
            return jsonify({"status": "error", "message": "'username' is required"}), 400
        # Insert into DB
        insert_user(body)
        return jsonify({"status": "success", "message": "User details stored successfully."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@login_app.post("/getLoginDetails")
def post_get_login_details():
    try:
        if request.headers.get("Content-Type", "").lower() != "application/json":
            return jsonify({"status": "error", "message": "Invalid Content-Type; expected application/json"}), 400
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return jsonify({"status": "error", "message": "Invalid JSON body"}), 400
        username = (body.get("username") or "").strip()
        if not username:
            return jsonify({"status": "error", "message": "'username' is required"}), 400
        record = get_user_by_username(username)
        if not record:
            return jsonify({"status": "not_found"}), 200
        return jsonify({"status": "found", "data": record}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _run_login():
    # Ensure DB schema exists before serving
    init_db()
    login_app.run(host="127.0.0.1", port=9574, use_reloader=False)


if __name__ == "__main__":
    # Start all servers concurrently; run the wipe method selector in the main thread for visibility
    t1 = threading.Thread(target=_run_devices, daemon=True)
    t1.start()
    t2 = threading.Thread(target=_run_wipe, daemon=True)
    t2.start()
    t3 = threading.Thread(target=_run_decrypt, daemon=True)
    t3.start()
    t4 = threading.Thread(target=_run_login, daemon=True)
    t4.start()
    _run_wipe_method()

