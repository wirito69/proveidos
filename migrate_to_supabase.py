import sqlite3
import json
import urllib.request
import os

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')


HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

def post_batch(table, rows):
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    data_json = json.dumps(rows).encode('utf-8')
    req = urllib.request.Request(url, data=data_json, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as res:
            print(f"✓ {table}: {len(rows)} registros subidos (HTTP {res.status})")
    except urllib.error.HTTPError as e:
        print(f"❌ Error en {table} (HTTP {e.code}): {e.read().decode('utf-8', errors='ignore')}")

def migrar():
    db_path = 'proveidos.db'
    if not os.path.exists(db_path):
        print("No se encontró proveidos.db")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 1. Configuración
    print("\n1. Migrando Configuración...")
    cfg_rows = [dict(r) for r in conn.execute("SELECT clave, valor FROM configuracion").fetchall()]
    post_batch('configuracion', cfg_rows)

    # 2. Destinatarios Frecuentes
    print("\n2. Migrando Destinatarios Frecuentes...")
    dest_rows = [dict(r) for r in conn.execute("SELECT id, nombre, cargo, frecuencia FROM destinatarios_frecuentes").fetchall()]
    post_batch('destinatarios_frecuentes', dest_rows)

    # 3. Proveídos
    print("\n3. Migrando Proveídos...")
    prov_raw = conn.execute("SELECT * FROM proveidos ORDER BY id ASC").fetchall()
    prov_batch = []
    for r in prov_raw:
        d = dict(r)
        # Parse JSON columns
        try:
            d['destinatarios'] = json.loads(d.get('destinatarios') or '[]')
        except:
            d['destinatarios'] = []
        try:
            d['check_opciones'] = json.loads(d.get('check_opciones') or '[]')
        except:
            d['check_opciones'] = []
        prov_batch.append(d)

    # Upload in chunks of 100
    chunk_size = 100
    for i in range(0, len(prov_batch), chunk_size):
        chunk = prov_batch[i:i + chunk_size]
        post_batch('proveidos', chunk)

    # 4. Elevaciones
    print("\n4. Migrando Elevaciones...")
    elev_raw = conn.execute("SELECT * FROM elevaciones ORDER BY id ASC").fetchall()
    elev_batch = []
    for r in elev_raw:
        d = dict(r)
        try:
            d['check_opciones'] = json.loads(d.get('check_opciones') or '[]')
        except:
            d['check_opciones'] = []
        elev_batch.append(d)

    for i in range(0, len(elev_batch), chunk_size):
        chunk = elev_batch[i:i + chunk_size]
        post_batch('elevaciones', chunk)

    # 5. Plantillas
    print("\n5. Migrando Plantillas...")
    plant_raw = conn.execute("SELECT * FROM plantillas ORDER BY id ASC").fetchall()
    plant_batch = []
    for r in plant_raw:
        d = dict(r)
        try:
            d['destinatarios'] = json.loads(d.get('destinatarios') or '[]')
        except:
            d['destinatarios'] = []
        try:
            d['check_opciones'] = json.loads(d.get('check_opciones') or '[]')
        except:
            d['check_opciones'] = []
        plant_batch.append(d)

    post_batch('plantillas', plant_batch)

    print("\n=========================================")
    print("  ¡MIGRACIÓN A SUPABASE COMPLETADA! 🎉   ")
    print("=========================================\n")

if __name__ == '__main__':
    migrar()
