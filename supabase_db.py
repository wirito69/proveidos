import os
import json
import datetime
import urllib.request
import urllib.parse
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')


def sb_request(method, endpoint, params=None, body=None, prefer=None):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    if params:
        query_string = urllib.parse.urlencode(params)
        url = f"{url}?{query_string}"

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    if prefer:
        headers['Prefer'] = prefer

    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as res:
        content_range = res.headers.get('Content-Range')
        total_count = None
        if content_range and '/' in content_range:
            try:
                total_count = int(content_range.split('/')[1])
            except:
                pass

        resp_data = res.read().decode('utf-8')
        result = json.loads(resp_data) if resp_data else None
        return result, total_count

def is_supabase_ready():
    try:
        sb_request('GET', 'proveidos', params={'limit': 1})
        return True
    except:
        return False

# ==========================================
# CONFIGURACIÓN
# ==========================================
def get_all_config():
    defaults = {
        'anio_activo': '2026',
        'institucion': 'UNIVERSIDAD NACIONAL HERMILIO VALDIZÁN',
        'dependencia': 'ESCUELA DE POSGRADO',
        'lugar_defecto': 'Cayhuayna',
        'sufijo_defecto': '-2026-UNHEVAL/EPG-D',
        'margen_top': '20',
        'margen_left': '22',
        'margen_right': '18',
        'margen_bottom': '18',
        'altura_firma': '140',
        'directora_nombre': 'Dra. Digna Amabilia Manrique de Lara Suarez',
        'directora_cargo': 'DIRECTORA'
    }
    try:
        rows, _ = sb_request('GET', 'configuracion')
        if rows:
            for r in rows:
                defaults[r['clave']] = r['valor']
    except Exception as e:
        print("Error get_all_config Supabase:", e)
    return defaults

def save_config_dict(data):
    for k, v in data.items():
        try:
            sb_request('POST', 'configuracion', body={'clave': k, 'valor': str(v)}, prefer='resolution=merge-duplicates')
        except Exception as e:
            print("Error save_config_dict Supabase:", e)

# ==========================================
# PROVEÍDOS
# ==========================================
def get_proveidos(query='', fecha_desde='', fecha_hasta='', estado_impresion='todos', page=1, per_page=20):
    params = {
        'select': '*',
        'order': 'numero.desc',
        'limit': per_page,
        'offset': (page - 1) * per_page
    }

    # Filtro eliminado = 0
    filters = ['eliminado.eq.0']

    if query:
        q = f"%{query}%"
        # Búsqueda or en Supabase
        filters.append(f"or=(asunto.ilike.{q},referencia.ilike.{q},remitente_ref.ilike.{q},registro.ilike.{q},codigo_formateado.ilike.{q})")

    if fecha_desde:
        filters.append(f"fecha_emision.gte.{fecha_desde}")
    if fecha_hasta:
        filters.append(f"fecha_emision.lte.{fecha_hasta}")

    if estado_impresion == 'impresos':
        filters.append("impreso.eq.1")
    elif estado_impresion == 'pendientes':
        filters.append("impreso.eq.0")

    # Combine filters into params
    for f in filters:
        if '=' in f and not f.startswith('or='):
            k, v = f.split('=', 1)
            params[k] = v
        elif f.startswith('or='):
            params['or'] = f[3:]

    try:
        items, total = sb_request('GET', 'proveidos', params=params, prefer='count=exact')
        if total is None:
            # Fallback count
            _, count_total = sb_request('GET', 'proveidos', params={'select': 'id', 'eliminado': 'eq.0'}, prefer='count=exact')
            total = count_total or len(items or [])

        # Sanitizar listas
        for it in (items or []):
            if not isinstance(it.get('destinatarios'), list):
                it['destinatarios'] = []
            if not isinstance(it.get('check_opciones'), list):
                it['check_opciones'] = []

        total_pages = max(1, (total + per_page - 1) // per_page) if total else 1
        return {
            'items': items or [],
            'total': total or 0,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }
    except Exception as e:
        print("Error get_proveidos Supabase:", e)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 1}

def get_proveido_by_id(pid):
    try:
        rows, _ = sb_request('GET', 'proveidos', params={'id': f'eq.{pid}'})
        if rows and len(rows) > 0:
            it = rows[0]
            if not isinstance(it.get('destinatarios'), list):
                it['destinatarios'] = []
            if not isinstance(it.get('check_opciones'), list):
                it['check_opciones'] = []
            return it
    except Exception as e:
        print("Error get_proveido_by_id Supabase:", e)
    return None

def get_next_proveido_numero(anio=2026):
    try:
        rows, _ = sb_request('GET', 'proveidos', params={'select': 'numero', 'order': 'numero.desc', 'limit': 1})
        if rows and len(rows) > 0:
            return (rows[0]['numero'] or 0) + 1
    except Exception as e:
        print("Error get_next_proveido_numero Supabase:", e)
    return 1

def save_proveido(data):
    numero = max(1, int(data.get('numero') or get_next_proveido_numero()))
    anio = max(2020, int(data.get('anio') or 2026))
    cod_formateado = f"{numero:04d}" if numero < 1000 else f"{numero}"
    sufijo = data.get('sufijo') or f"-{anio}-UNHEVAL/EPG-D"

    destinatarios = data.get('destinatarios', [])
    dest_prin = destinatarios[0].get('nombre', '') if destinatarios else ''
    cargo_prin = destinatarios[0].get('cargo', '') if destinatarios else ''

    record = {
        'numero': numero,
        'codigo_formateado': cod_formateado,
        'anio': anio,
        'sufijo': sufijo,
        'tipo': data.get('tipo', 'SIMPLE'),
        'destinatarios': destinatarios,
        'destinatario_principal': dest_prin,
        'cargo_principal': cargo_prin,
        'asunto': data.get('asunto', '').strip(),
        'referencia': data.get('referencia', '').strip(),
        'remitente_ref': data.get('remitente_ref', '').strip(),
        'registro': data.get('registro', '').strip(),
        'fecha_recibido': data.get('fecha_recibido', ''),
        'fecha_emision': data.get('fecha_emision', ''),
        'lugar_emision': data.get('lugar_emision', 'Cayhuayna'),
        'disposicion': data.get('disposicion', '').strip(),
        'check_opciones': data.get('check_opciones', []),
        'eliminado': 0
    }

    pid = data.get('id')
    if pid:
        sb_request('PATCH', 'proveidos', params={'id': f'eq.{pid}'}, body=record)
        return pid
    else:
        res, _ = sb_request('POST', 'proveidos', body=record, prefer='return=representation')
        return res[0]['id'] if res else None

def delete_proveido(pid):
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sb_request('PATCH', 'proveidos', params={'id': f'eq.{pid}'}, body={'eliminado': 1, 'fecha_eliminacion': now_str})
    return True

def toggle_impreso_proveido(pid):
    p = get_proveido_by_id(pid)
    if not p:
        return False
    nuevo_impreso = 0 if p.get('impreso') == 1 else 1
    nuevo_veces = p.get('veces_impreso', 0)
    if nuevo_impreso == 1 and nuevo_veces == 0:
        nuevo_veces = 1
    elif nuevo_impreso == 0:
        nuevo_veces = 0
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S') if nuevo_impreso == 1 else None

    sb_request('PATCH', 'proveidos', params={'id': f'eq.{pid}'}, body={
        'impreso': nuevo_impreso,
        'veces_impreso': nuevo_veces,
        'fecha_impresion': now_str
    })
    return {"impreso": nuevo_impreso, "veces_impreso": nuevo_veces}

def marcar_proveido_impreso(pid):
    p = get_proveido_by_id(pid)
    veces = (p.get('veces_impreso', 0) if p else 0) + 1
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sb_request('PATCH', 'proveidos', params={'id': f'eq.{pid}'}, body={
        'impreso': 1,
        'veces_impreso': veces,
        'fecha_impresion': now_str
    })
    return True

def marcar_proveidos_impresos_lote(ids):
    for pid in ids:
        marcar_proveido_impreso(pid)

def get_proveidos_by_range(num_desde, num_hasta):
    num_desde = max(1, int(num_desde))
    num_hasta = max(num_desde, int(num_hasta))
    params = {
        'numero': f'gte.{num_desde}',
        'numero': f'lte.{num_hasta}',
        'eliminado': 'eq.0',
        'order': 'numero.asc'
    }
    # Handled via raw request
    url_params = f"numero=gte.{num_desde}&numero=lte.{num_hasta}&eliminado=eq.0&order=numero.asc"
    items, _ = sb_request('GET', f'proveidos?{url_params}')
    for it in (items or []):
        marcar_proveido_impreso(it['id'])
    return items or []

def get_rango_info():
    try:
        rows, total = sb_request('GET', 'proveidos', params={'select': 'numero,impreso', 'eliminado': 'eq.0', 'order': 'numero.desc'}, prefer='count=exact')
        if not rows:
            return {"min_num": 1, "max_num": 1, "total": 0, "pendientes_min": None, "pendientes_max": None, "pendientes_count": 0, "numeros": []}

        numeros = [r['numero'] for r in rows]
        pendientes = [r['numero'] for r in rows if not r.get('impreso')]

        return {
            "min_num": min(numeros) if numeros else 1,
            "max_num": max(numeros) if numeros else 1,
            "total": total or len(numeros),
            "pendientes_min": min(pendientes) if pendientes else None,
            "pendientes_max": max(pendientes) if pendientes else None,
            "pendientes_count": len(pendientes),
            "numeros": numeros
        }
    except Exception as e:
        print("Error get_rango_info Supabase:", e)
        return {"min_num": 1, "max_num": 1, "total": 0, "pendientes_min": None, "pendientes_max": None, "pendientes_count": 0, "numeros": []}

# ==========================================
# ELEVACIONES
# ==========================================
def get_elevaciones(query='', fecha_desde='', fecha_hasta='', estado_impresion='todos', page=1, per_page=20):
    params = {
        'select': '*',
        'order': 'numero.desc',
        'limit': per_page,
        'offset': (page - 1) * per_page,
        'eliminado': 'eq.0'
    }
    if query:
        q = f"%{query}%"
        params['or'] = f"(asunto.ilike.{q},referencia.ilike.{q},remitente_ref.ilike.{q},registro.ilike.{q},destinatario.ilike.{q},codigo_formateado.ilike.{q})"

    if fecha_desde:
        params['fecha_emision'] = f"gte.{fecha_desde}"
    if fecha_hasta:
        params['fecha_emision'] = f"lte.{fecha_hasta}"

    if estado_impresion == 'impresos':
        params['impreso'] = "eq.1"
    elif estado_impresion == 'pendientes':
        params['impreso'] = "eq.0"

    try:
        items, total = sb_request('GET', 'elevaciones', params=params, prefer='count=exact')
        if total is None:
            _, count_total = sb_request('GET', 'elevaciones', params={'select': 'id', 'eliminado': 'eq.0'}, prefer='count=exact')
            total = count_total or len(items or [])

        for it in (items or []):
            if not isinstance(it.get('check_opciones'), list):
                it['check_opciones'] = []

        total_pages = max(1, (total + per_page - 1) // per_page) if total else 1
        return {
            'items': items or [],
            'total': total or 0,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }
    except Exception as e:
        print("Error get_elevaciones Supabase:", e)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 1}

def get_elevacion_by_id(eid):
    try:
        rows, _ = sb_request('GET', 'elevaciones', params={'id': f'eq.{eid}'})
        if rows:
            it = rows[0]
            if not isinstance(it.get('check_opciones'), list):
                it['check_opciones'] = []
            return it
    except Exception as e:
        print("Error get_elevacion_by_id Supabase:", e)
    return None

def get_next_elevacion_numero(anio=2026):
    try:
        rows, _ = sb_request('GET', 'elevaciones', params={'select': 'numero', 'order': 'numero.desc', 'limit': 1})
        if rows:
            return (rows[0]['numero'] or 0) + 1
    except Exception as e:
        print("Error get_next_elevacion_numero Supabase:", e)
    return 1

def save_elevacion(data):
    numero = max(1, int(data.get('numero') or get_next_elevacion_numero()))
    anio = max(2020, int(data.get('anio') or 2026))
    cod_formateado = f"{numero:04d}"
    sufijo = data.get('sufijo') or f"-{anio}-UNHEVAL/EPG-D"

    record = {
        'numero': numero,
        'codigo_formateado': cod_formateado,
        'anio': anio,
        'sufijo': sufijo,
        'destinatario': data.get('destinatario', '').strip(),
        'asunto': data.get('asunto', '').strip(),
        'referencia': data.get('referencia', '').strip(),
        'remitente_ref': data.get('remitente_ref', '').strip(),
        'registro': data.get('registro', '').strip(),
        'fecha_recibido': data.get('fecha_recibido', ''),
        'fecha_emision': data.get('fecha_emision', ''),
        'lugar_emision': data.get('lugar_emision', 'Cayhuayna'),
        'disposicion': data.get('disposicion', '').strip(),
        'check_opciones': data.get('check_opciones', []),
        'eliminado': 0
    }

    eid = data.get('id')
    if eid:
        sb_request('PATCH', 'elevaciones', params={'id': f'eq.{eid}'}, body=record)
        return eid
    else:
        res, _ = sb_request('POST', 'elevaciones', body=record, prefer='return=representation')
        return res[0]['id'] if res else None

def delete_elevacion(eid):
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sb_request('PATCH', 'elevaciones', params={'id': f'eq.{eid}'}, body={'eliminado': 1, 'fecha_eliminacion': now_str})
    return True

def toggle_impreso_elevacion(eid):
    e = get_elevacion_by_id(eid)
    if not e:
        return False
    nuevo_impreso = 0 if e.get('impreso') == 1 else 1
    nuevo_veces = e.get('veces_impreso', 0)
    if nuevo_impreso == 1 and nuevo_veces == 0:
        nuevo_veces = 1
    elif nuevo_impreso == 0:
        nuevo_veces = 0
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S') if nuevo_impreso == 1 else None

    sb_request('PATCH', 'elevaciones', params={'id': f'eq.{eid}'}, body={
        'impreso': nuevo_impreso,
        'veces_impreso': nuevo_veces,
        'fecha_impresion': now_str
    })
    return {"impreso": nuevo_impreso, "veces_impreso": nuevo_veces}

def marcar_elevacion_impresa(eid):
    e = get_elevacion_by_id(eid)
    veces = (e.get('veces_impreso', 0) if e else 0) + 1
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    sb_request('PATCH', 'elevaciones', params={'id': f'eq.{eid}'}, body={
        'impreso': 1,
        'veces_impreso': veces,
        'fecha_impresion': now_str
    })
    return True

def marcar_elevaciones_impresas_lote(ids):
    for eid in ids:
        marcar_elevacion_impresa(eid)

def get_elevaciones_by_range(num_desde, num_hasta):
    num_desde = max(1, int(num_desde))
    num_hasta = max(num_desde, int(num_hasta))
    url_params = f"numero=gte.{num_desde}&numero=lte.{num_hasta}&eliminado=eq.0&order=numero.asc"
    items, _ = sb_request('GET', f'elevaciones?{url_params}')
    for it in (items or []):
        marcar_elevacion_impresa(it['id'])
    return items or []

def get_rango_info_elevaciones():
    try:
        rows, total = sb_request('GET', 'elevaciones', params={'select': 'numero,impreso', 'eliminado': 'eq.0', 'order': 'numero.desc'}, prefer='count=exact')
        if not rows:
            return {"min_num": 1, "max_num": 1, "total": 0, "pendientes_min": None, "pendientes_max": None, "pendientes_count": 0, "numeros": []}

        numeros = [r['numero'] for r in rows]
        pendientes = [r['numero'] for r in rows if not r.get('impreso')]

        return {
            "min_num": min(numeros) if numeros else 1,
            "max_num": max(numeros) if numeros else 1,
            "total": total or len(numeros),
            "pendientes_min": min(pendientes) if pendientes else None,
            "pendientes_max": max(pendientes) if pendientes else None,
            "pendientes_count": len(pendientes),
            "numeros": numeros
        }
    except Exception as e:
        print("Error get_rango_info_elevaciones Supabase:", e)
        return {"min_num": 1, "max_num": 1, "total": 0, "pendientes_min": None, "pendientes_max": None, "pendientes_count": 0, "numeros": []}

# ==========================================
# PLANTILLAS
# ==========================================
def get_plantillas(tipo_doc='proveido'):
    try:
        rows, _ = sb_request('GET', 'plantillas', params={'tipo_doc': f'eq.{tipo_doc}', 'order': 'es_predeterminada.desc,id.asc'})
        for r in (rows or []):
            if not isinstance(r.get('destinatarios'), list):
                r['destinatarios'] = []
            if not isinstance(r.get('check_opciones'), list):
                r['check_opciones'] = []
        return rows or []
    except Exception as e:
        print("Error get_plantillas Supabase:", e)
        return []

def save_plantilla(data):
    tipo_doc = data.get('tipo_doc', 'proveido')
    nombre = data.get('nombre', '').strip()
    if not nombre:
        raise ValueError("El nombre de la plantilla es obligatorio")

    record = {
        'tipo_doc': tipo_doc,
        'nombre': nombre,
        'icono': data.get('icono', '📋').strip() or '📋',
        'asunto': data.get('asunto', '').strip(),
        'disposicion': data.get('disposicion', '').strip(),
        'destinatarios': data.get('destinatarios', []),
        'destinatario': data.get('destinatario', '').strip(),
        'check_opciones': data.get('check_opciones', []),
        'es_predeterminada': 0
    }
    res, _ = sb_request('POST', 'plantillas', body=record, prefer='return=representation')
    return res[0]['id'] if res else None

def delete_plantilla(pid):
    sb_request('DELETE', 'plantillas', params={'id': f'eq.{pid}'})
    return True

def reset_default_plantillas(tipo_doc='proveido'):
    # Eliminar predeterminadas de ese tipo
    sb_request('DELETE', 'plantillas', params={'tipo_doc': f'eq.{tipo_doc}', 'es_predeterminada': 'eq.1'})
    # Seeds predefinidos
    seeds_proveido = [
        {'nombre': 'Acuse de Recibo', 'icono': '📨', 'asunto': 'Acuse de Recibo de Documento',
         'disposicion': 'Acúsese recibo del presente documento y archívese.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
        {'nombre': 'Trámite y Atención', 'icono': '📋', 'asunto': 'Para su Trámite y Atención Correspondiente',
         'disposicion': 'Pase al interesado para los fines pertinentes.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
        {'nombre': 'Para Conocimiento', 'icono': '📌', 'asunto': 'Para Conocimiento y Fines Pertinentes',
         'disposicion': 'Hágase conocer a los interesados para los fines a que hubiere lugar.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
        {'nombre': 'Informe Requerido', 'icono': '📊', 'asunto': 'Solicitud de Informe',
         'disposicion': 'Sírvase presentar el informe correspondiente en el plazo de 05 días hábiles.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
    ]
    seeds_elevacion = [
        {'nombre': 'Elevar con Informe', 'icono': '📤', 'asunto': 'Elevar con Informe al Despacho Superior',
         'disposicion': 'Elévese el presente documento con informe al despacho.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
        {'nombre': 'Para Resolución', 'icono': '⚖️', 'asunto': 'Para Emisión de Resolución',
         'disposicion': 'Elévese para la emisión de la Resolución correspondiente.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
        {'nombre': 'Visación VB', 'icono': '✅', 'asunto': 'Para Visación y Visto Bueno',
         'disposicion': 'Elévese para visación y visto bueno del señor Rector.', 'destinatarios': [], 'destinatario': '', 'check_opciones': []},
    ]
    seeds = seeds_proveido if tipo_doc == 'proveido' else seeds_elevacion
    for s in seeds:
        record = {**s, 'tipo_doc': tipo_doc, 'es_predeterminada': 1}
        try:
            sb_request('POST', 'plantillas', body=record)
        except Exception as e:
            print("Error inserting seed plantilla:", e)
    return True


# ==========================================
# PAPELERA (HISTORIAL DE BORRADOS)
# ==========================================
def get_papelera():
    items = []
    try:
        provs, _ = sb_request('GET', 'proveidos', params={'eliminado': 'eq.1', 'order': 'fecha_eliminacion.desc'})
        for p in (provs or []):
            dest = p.get('destinatario_principal', '')
            if not dest and isinstance(p.get('destinatarios'), list) and len(p['destinatarios']) > 0:
                dest = p['destinatarios'][0].get('nombre', '')
            items.append({
                'tipo': 'proveido',
                'id': p['id'],
                'numero': p['numero'],
                'codigo_formateado': p['codigo_formateado'],
                'sufijo': p['sufijo'],
                'destinatario': dest,
                'asunto': p.get('asunto', ''),
                'fecha_eliminado': p.get('fecha_eliminacion')
            })

        elevs, _ = sb_request('GET', 'elevaciones', params={'eliminado': 'eq.1', 'order': 'fecha_eliminacion.desc'})
        for e in (elevs or []):
            items.append({
                'tipo': 'elevacion',
                'id': e['id'],
                'numero': e['numero'],
                'codigo_formateado': e['codigo_formateado'],
                'sufijo': e['sufijo'],
                'destinatario': e.get('destinatario', ''),
                'asunto': e.get('asunto', ''),
                'fecha_eliminado': e.get('fecha_eliminacion')
            })

        items.sort(key=lambda x: x.get('fecha_eliminado') or '', reverse=True)
    except Exception as e:
        print("Error get_papelera Supabase:", e)
    return items

def restaurar_elemento(tipo, id_elem):
    table = 'proveidos' if tipo == 'proveido' else 'elevaciones'
    sb_request('PATCH', table, params={'id': f'eq.{id_elem}'}, body={'eliminado': 0, 'fecha_eliminacion': None})
    return True

def eliminar_permanente(tipo, id_elem):
    table = 'proveidos' if tipo == 'proveido' else 'elevaciones'
    sb_request('DELETE', table, params={'id': f'eq.{id_elem}'})
    return True

def vaciar_papelera():
    sb_request('DELETE', 'proveidos', params={'eliminado': 'eq.1'})
    sb_request('DELETE', 'elevaciones', params={'eliminado': 'eq.1'})
    return True

# ==========================================
# DESTINATARIOS SUGERENCIAS
# ==========================================
def get_destinatarios_sugerencias():
    try:
        rows, _ = sb_request('GET', 'destinatarios_frecuentes', params={'order': 'frecuencia.desc,nombre.asc'})
        return rows or []
    except:
        return []

# ==========================================
# ANALYTICS DASHBOARD
# ==========================================
def get_analytics_dashboard():
    try:
        prov_rows, prov_total = sb_request('GET', 'proveidos', params={'select': 'impreso,fecha_emision,anio', 'eliminado': 'eq.0'}, prefer='count=exact')
        elev_rows, elev_total = sb_request('GET', 'elevaciones', params={'select': 'impreso,fecha_emision,anio', 'eliminado': 'eq.0'}, prefer='count=exact')

        prov_rows = prov_rows or []
        elev_rows = elev_rows or []

        prov_pend = sum(1 for r in prov_rows if not r.get('impreso'))
        elev_pend = sum(1 for r in elev_rows if not r.get('impreso'))

        # Agrupación por mes
        from collections import defaultdict
        meses = defaultdict(lambda: {'proveidos': 0, 'elevaciones': 0})
        for r in prov_rows:
            fe = (r.get('fecha_emision') or '')[:7]
            if fe:
                meses[fe]['proveidos'] += 1
        for r in elev_rows:
            fe = (r.get('fecha_emision') or '')[:7]
            if fe:
                meses[fe]['elevaciones'] += 1

        meses_sorted = sorted(meses.items())[-12:]
        meses_labels = [m[0] for m in meses_sorted]
        meses_prov = [m[1]['proveidos'] for m in meses_sorted]
        meses_elev = [m[1]['elevaciones'] for m in meses_sorted]

        return {
            'total_proveidos': prov_total or len(prov_rows),
            'total_elevaciones': elev_total or len(elev_rows),
            'proveidos_pendientes': prov_pend,
            'elevaciones_pendientes': elev_pend,
            'proveidos_impresos': (prov_total or len(prov_rows)) - prov_pend,
            'elevaciones_impresas': (elev_total or len(elev_rows)) - elev_pend,
            'meses_labels': meses_labels,
            'meses_proveidos': meses_prov,
            'meses_elevaciones': meses_elev,
        }
    except Exception as e:
        print("Error get_analytics_dashboard Supabase:", e)
        return {
            'total_proveidos': 0, 'total_elevaciones': 0,
            'proveidos_pendientes': 0, 'elevaciones_pendientes': 0,
            'proveidos_impresos': 0, 'elevaciones_impresas': 0,
            'meses_labels': [], 'meses_proveidos': [], 'meses_elevaciones': []
        }

def export_to_excel(output_filename):
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    wb = openpyxl.Workbook()

    # --- Hoja PROVEÍDOS ---
    ws_p = wb.active
    ws_p.title = "PROVEÍDOS"
    header_fill = PatternFill("solid", fgColor="1F3864")
    header_font = Font(bold=True, color="FFFFFF", size=10)
    border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    headers_p = ['N°', 'CÓDIGO', 'FECHA EMISIÓN', 'DESTINATARIO', 'CARGO', 'ASUNTO', 'REFERENCIA', 'REGISTRO', 'DISPOSICIÓN', 'IMPRESO', 'VECES']
    for col, h in enumerate(headers_p, 1):
        cell = ws_p.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = border

    try:
        prov_rows, _ = sb_request('GET', 'proveidos', params={
            'select': '*', 'eliminado': 'eq.0', 'order': 'numero.asc'
        })
        for i, p in enumerate(prov_rows or [], 2):
            dest = p.get('destinatario_principal', '')
            if not dest and isinstance(p.get('destinatarios'), list) and p['destinatarios']:
                dest = p['destinatarios'][0].get('nombre', '')
            cargo = p.get('cargo_principal', '')
            if not cargo and isinstance(p.get('destinatarios'), list) and p['destinatarios']:
                cargo = p['destinatarios'][0].get('cargo', '')
            row_data = [
                p.get('numero'), p.get('codigo_formateado', '') + p.get('sufijo', ''),
                p.get('fecha_emision', ''), dest, cargo,
                p.get('asunto', ''), p.get('referencia', ''),
                p.get('registro', ''), p.get('disposicion', ''),
                'Sí' if p.get('impreso') else 'No', p.get('veces_impreso', 0)
            ]
            for col, val in enumerate(row_data, 1):
                cell = ws_p.cell(row=i, column=col, value=val)
                cell.alignment = Alignment(wrap_text=True, vertical='center')
                cell.border = border
        ws_p.row_dimensions[1].height = 30
        col_widths_p = [6, 28, 14, 30, 25, 45, 30, 20, 40, 8, 7]
        for col, w in enumerate(col_widths_p, 1):
            ws_p.column_dimensions[ws_p.cell(row=1, column=col).column_letter].width = w
    except Exception as e:
        print("Error export proveidos:", e)

    # --- Hoja ELEVACIONES ---
    ws_e = wb.create_sheet("ELEVACIONES")
    headers_e = ['N°', 'CÓDIGO', 'FECHA EMISIÓN', 'DESTINATARIO', 'ASUNTO', 'REFERENCIA', 'REGISTRO', 'DISPOSICIÓN', 'IMPRESO', 'VECES']
    for col, h in enumerate(headers_e, 1):
        cell = ws_e.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = border

    try:
        elev_rows, _ = sb_request('GET', 'elevaciones', params={
            'select': '*', 'eliminado': 'eq.0', 'order': 'numero.asc'
        })
        for i, e in enumerate(elev_rows or [], 2):
            row_data = [
                e.get('numero'), e.get('codigo_formateado', '') + e.get('sufijo', ''),
                e.get('fecha_emision', ''), e.get('destinatario', ''),
                e.get('asunto', ''), e.get('referencia', ''),
                e.get('registro', ''), e.get('disposicion', ''),
                'Sí' if e.get('impreso') else 'No', e.get('veces_impreso', 0)
            ]
            for col, val in enumerate(row_data, 1):
                cell = ws_e.cell(row=i, column=col, value=val)
                cell.alignment = Alignment(wrap_text=True, vertical='center')
                cell.border = border
        ws_e.row_dimensions[1].height = 30
        col_widths_e = [6, 28, 14, 35, 45, 30, 20, 40, 8, 7]
        for col, w in enumerate(col_widths_e, 1):
            ws_e.column_dimensions[ws_e.cell(row=1, column=col).column_letter].width = w
    except Exception as e:
        print("Error export elevaciones:", e)

    wb.save(output_filename)

