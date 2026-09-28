# -*- coding: utf-8 -*-
# Migracion de datos SQLite -> Supabase
# Ejecutar: python migrar_datos.py (con SUPABASE_URL y SUPABASE_KEY en entorno)
import sqlite3, json, urllib.request, urllib.error, os, sys

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Falta SUPABASE_URL o SUPABASE_KEY")
    print("Ejecuta primero en PowerShell:")
    print('  $env:SUPABASE_URL="https://bywayryubqylxmzdumri.supabase.co"')
    print('  $env:SUPABASE_KEY="<tu-clave-secreta-de-supabase>"')
    sys.exit(1)


HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
}

def test_table(table):
    url = SUPABASE_URL + '/rest/v1/' + table + '?limit=1'
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as res:
            return True
    except:
        return False

def insert_batch(table, rows, batch_size=50):
    if not rows:
        return 0
    h = dict(HEADERS)
    h['Prefer'] = 'resolution=merge-duplicates'
    inserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        url = SUPABASE_URL + '/rest/v1/' + table
        body = json.dumps(batch, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(url, data=body, headers=h, method='POST')
        try:
            with urllib.request.urlopen(req) as res:
                inserted += len(batch)
                print('    Insertados ' + str(inserted) + '/' + str(len(rows)) + '...', end='\r')
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='replace')
            print('\n    ERROR en lote: ' + err[:200])
    print()
    return inserted

# Verificar tablas
print('=== Verificando tablas en Supabase ===')
tablas_necesarias = ['configuracion', 'proveidos', 'elevaciones', 'plantillas', 'destinatarios_frecuentes']
todas_ok = True
for t in tablas_necesarias:
    ok = test_table(t)
    print('  [' + ('OK' if ok else 'FALTA') + '] ' + t)
    if not ok:
        todas_ok = False

if not todas_ok:
    print()
    print('Las tablas NO existen en Supabase todavia.')
    print()
    print('=' * 65)
    print('DEBES crear las tablas primero:')
    print()
    print('1. Ve a este enlace:')
    print('   https://supabase.com/dashboard/project/bywayryubqylxmzdumri/sql/new')
    print()
    print('2. Copia el contenido de: supabase_schema.sql')
    print()
    print('3. Pegalo en el editor y haz clic en RUN')
    print()
    print('4. Vuelve a ejecutar: python migrar_datos.py')
    print('=' * 65)
    sys.exit(1)

print()
print('Todas las tablas existen. Iniciando migracion...')
print()

# Conectar al SQLite local
conn = sqlite3.connect('proveidos.db')
conn.row_factory = sqlite3.Row

# ---- CONFIGURACION ----
print('Migrando configuracion...')
cfg_rows = conn.execute('SELECT clave, valor FROM configuracion').fetchall()
cfg_data = [{'clave': r['clave'], 'valor': r['valor']} for r in cfg_rows]
n = insert_batch('configuracion', cfg_data)
print('  OK: ' + str(n) + ' registros de configuracion')

# ---- PROVEIDOS ----
print('Migrando proveidos...')
prov_rows = conn.execute("""
    SELECT numero, codigo_formateado, anio, sufijo, tipo,
           destinatarios, destinatario_principal, cargo_principal,
           asunto, referencia, remitente_ref, registro,
           fecha_recibido, fecha_emision, lugar_emision, disposicion,
           check_opciones, estado, impreso, veces_impreso,
           fecha_impresion, eliminado, fecha_eliminacion
    FROM proveidos ORDER BY numero ASC
""").fetchall()

prov_data = []
for r in prov_rows:
    dest = r['destinatarios']
    try:
        dest = json.loads(dest) if isinstance(dest, str) else (dest or [])
    except:
        dest = []
    chk = r['check_opciones']
    try:
        chk = json.loads(chk) if isinstance(chk, str) else (chk or [])
    except:
        chk = []
    prov_data.append({
        'numero': r['numero'],
        'codigo_formateado': r['codigo_formateado'],
        'anio': r['anio'],
        'sufijo': r['sufijo'],
        'tipo': r['tipo'] or 'SIMPLE',
        'destinatarios': dest,
        'destinatario_principal': r['destinatario_principal'] or '',
        'cargo_principal': r['cargo_principal'] or '',
        'asunto': r['asunto'],
        'referencia': r['referencia'] or '',
        'remitente_ref': r['remitente_ref'] or '',
        'registro': r['registro'] or '',
        'fecha_recibido': r['fecha_recibido'] or '',
        'fecha_emision': r['fecha_emision'] or '',
        'lugar_emision': r['lugar_emision'] or 'Cayhuayna',
        'disposicion': r['disposicion'] or '',
        'check_opciones': chk,
        'estado': r['estado'] or 'EMITIDO',
        'impreso': r['impreso'] or 0,
        'veces_impreso': r['veces_impreso'] or 0,
        'fecha_impresion': r['fecha_impresion'],
        'eliminado': r['eliminado'] or 0,
        'fecha_eliminacion': r['fecha_eliminacion'],
    })

n = insert_batch('proveidos', prov_data)
print('  OK: ' + str(n) + ' proveidos migrados')

# ---- ELEVACIONES ----
print('Migrando elevaciones...')
elev_rows = conn.execute("""
    SELECT numero, codigo_formateado, anio, sufijo, destinatario,
           asunto, referencia, remitente_ref, registro,
           fecha_recibido, fecha_emision, lugar_emision, disposicion,
           check_opciones, estado, impreso, veces_impreso,
           fecha_impresion, eliminado, fecha_eliminacion
    FROM elevaciones ORDER BY numero ASC
""").fetchall()

elev_data = []
for r in elev_rows:
    chk = r['check_opciones']
    try:
        chk = json.loads(chk) if isinstance(chk, str) else (chk or [])
    except:
        chk = []
    elev_data.append({
        'numero': r['numero'],
        'codigo_formateado': r['codigo_formateado'],
        'anio': r['anio'],
        'sufijo': r['sufijo'],
        'destinatario': r['destinatario'] or '',
        'asunto': r['asunto'],
        'referencia': r['referencia'] or '',
        'remitente_ref': r['remitente_ref'] or '',
        'registro': r['registro'] or '',
        'fecha_recibido': r['fecha_recibido'] or '',
        'fecha_emision': r['fecha_emision'] or '',
        'lugar_emision': r['lugar_emision'] or 'Cayhuayna',
        'disposicion': r['disposicion'] or '',
        'check_opciones': chk,
        'estado': r['estado'] or 'EMITIDO',
        'impreso': r['impreso'] or 0,
        'veces_impreso': r['veces_impreso'] or 0,
        'fecha_impresion': r['fecha_impresion'],
        'eliminado': r['eliminado'] or 0,
        'fecha_eliminacion': r['fecha_eliminacion'],
    })

n = insert_batch('elevaciones', elev_data)
print('  OK: ' + str(n) + ' elevaciones migradas')

# ---- PLANTILLAS ----
print('Migrando plantillas...')
plant_rows = conn.execute('SELECT * FROM plantillas').fetchall()
plant_data = []
for r in plant_rows:
    keys = r.keys()
    dest = r['destinatarios'] if 'destinatarios' in keys else '[]'
    try:
        dest = json.loads(dest) if isinstance(dest, str) else (dest or [])
    except:
        dest = []
    chk = r['check_opciones'] if 'check_opciones' in keys else '[]'
    try:
        chk = json.loads(chk) if isinstance(chk, str) else (chk or [])
    except:
        chk = []
    plant_data.append({
        'tipo_doc': r['tipo_doc'],
        'nombre': r['nombre'],
        'icono': r['icono'] or '',
        'asunto': r['asunto'] or '',
        'disposicion': r['disposicion'] or '',
        'destinatarios': dest,
        'destinatario': r['destinatario'] if 'destinatario' in keys else '',
        'check_opciones': chk,
        'es_predeterminada': r['es_predeterminada'] or 0,
    })

n = insert_batch('plantillas', plant_data)
print('  OK: ' + str(n) + ' plantillas migradas')

# ---- DESTINATARIOS ----
print('Migrando destinatarios frecuentes...')
dest_rows = conn.execute('SELECT nombre, cargo, frecuencia FROM destinatarios_frecuentes').fetchall()
dest_data = [{'nombre': r['nombre'], 'cargo': r['cargo'] or '', 'frecuencia': r['frecuencia'] or 1} for r in dest_rows]
n = insert_batch('destinatarios_frecuentes', dest_data)
print('  OK: ' + str(n) + ' destinatarios migrados')

print()
print('=== MIGRACION COMPLETADA ===')
print('Proveidos:    ' + str(len(prov_data)))
print('Elevaciones:  ' + str(len(elev_data)))
print('Plantillas:   ' + str(len(plant_data)))
print('Destinatarios: ' + str(len(dest_data)))
print()
print('La aplicacion en Vercel ya tiene todos los datos:')
print('  https://proveidos.vercel.app')
