"""
Script para verificar tablas en Supabase.
Ejecutar desde: c:/Users/joell/Desktop/proveidos

Uso:
  $env:SUPABASE_URL="https://bywayryubqylxmzdumri.supabase.co"
  $env:SUPABASE_KEY="<tu-clave-secreta>"
  python crear_tablas_supabase.py
"""
import urllib.request, json, os

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Configura SUPABASE_URL y SUPABASE_KEY como variables de entorno")
    exit(1)

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def sb_post(table, record):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(record).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req) as res:
            return True, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        return False, e.read().decode()

def test_connection():
    url = f"{SUPABASE_URL}/rest/v1/configuracion?limit=1"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as res:
            return True, res.status
    except urllib.error.HTTPError as e:
        return False, e.read().decode()

print("=== Verificando conexión a Supabase ===")
ok, result = test_connection()
if ok:
    print(f"✅ Tablas ya existen! Conexión exitosa.")
    print("\nPuedes usar la aplicación en: https://proveidos.vercel.app")
else:
    err = result if isinstance(result, str) else str(result)
    if 'PGRST205' in err or 'table' in err.lower():
        print("❌ Las tablas NO existen aún en Supabase.")
        print()
        print("INSTRUCCIONES PARA CREAR LAS TABLAS:")
        print("=" * 60)
        print("1. Ve a: https://supabase.com/dashboard/project/bywayryubqylxmzdumri/sql/new")
        print("2. Copia y pega el contenido de: supabase_schema.sql")
        print("3. Haz clic en 'Run'")
        print("4. Vuelve a ejecutar este script para verificar")
        print("=" * 60)
    else:
        print(f"ERROR desconocido: {err[:300]}")
