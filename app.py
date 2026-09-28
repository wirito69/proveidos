from flask import Flask, render_template, request, jsonify, send_file
import database as db
import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR, 'templates'),
            static_folder=os.path.join(BASE_DIR, 'static'))
app.config['JSON_AS_ASCII'] = False
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True

DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
MESES_PERU = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Setiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

def format_fecha_oficial(fecha_str):
    if not fecha_str:
        return ""
    try:
        dt = datetime.datetime.strptime(fecha_str[:10], '%Y-%m-%d')
        dia_nom = DIAS_SEMANA[dt.weekday()]
        mes_nom = MESES_PERU[dt.month]
        return f"{dia_nom}, {dt.day} de {mes_nom} de {dt.year}"
    except:
        return fecha_str


@app.route('/')
def index():
    return render_template('index.html')

# === PROVEÍDOS API ===
@app.route('/api/proveidos', methods=['GET'])
def list_proveidos():
    query = request.args.get('q', '')
    fecha_desde = request.args.get('desde', '')
    fecha_hasta = request.args.get('hasta', '')
    estado_impresion = request.args.get('estado_impresion', 'todos')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 25))
    
    result = db.get_proveidos(
        query=query, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        estado_impresion=estado_impresion, page=page, per_page=per_page
    )
    return jsonify(result)

@app.route('/api/proveidos/<int:pid>', methods=['GET'])
def get_proveido(pid):
    p = db.get_proveido_by_id(pid)
    if not p:
        return jsonify({'error': 'No encontrado'}), 404
    p['fecha_emision_oficial'] = format_fecha_oficial(p.get('fecha_emision'))
    p['fecha_recibido_oficial'] = format_fecha_oficial(p.get('fecha_recibido'))
    return jsonify(p)

@app.route('/api/proveidos', methods=['POST'])
def save_proveido():
    data = request.json or {}
    pid = db.save_proveido(data)
    saved = db.get_proveido_by_id(pid)
    return jsonify({'success': True, 'item': saved})

@app.route('/api/proveidos/<int:pid>', methods=['DELETE'])
def delete_proveido(pid):
    db.delete_proveido(pid)
    return jsonify({'success': True})

@app.route('/api/proveidos/<int:pid>/toggle-impreso', methods=['POST'])
def toggle_impreso(pid):
    res = db.toggle_impreso_proveido(pid)
    return jsonify({'success': True, 'data': res})

@app.route('/api/proveidos/<int:pid>/marcar-impreso', methods=['POST'])
def api_marcar_impreso(pid):
    db.marcar_proveido_impreso(pid)
    item = db.get_proveido_by_id(pid)
    return jsonify({'success': True, 'item': item})

@app.route('/api/proveidos/rango-info', methods=['GET'])
def rango_info():
    info = db.get_rango_info()
    return jsonify(info)

@app.route('/api/proveidos/siguiente-numero', methods=['GET'])
def next_proveido_num():
    anio = int(request.args.get('anio', 2026))
    num = db.get_next_proveido_numero(anio)
    cod = f"{num:04d}" if num < 1000 else f"{num}"
    return jsonify({'numero': num, 'codigo_formateado': cod, 'sufijo': f'-{anio}-UNHEVAL/EPG-D'})

# === ELEVACIONES API ===
@app.route('/api/elevaciones', methods=['GET'])
def list_elevaciones():
    query = request.args.get('q', '')
    fecha_desde = request.args.get('desde', '')
    fecha_hasta = request.args.get('hasta', '')
    estado_impresion = request.args.get('estado_impresion', 'todos')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 25))
    
    result = db.get_elevaciones(query=query, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta, estado_impresion=estado_impresion, page=page, per_page=per_page)
    return jsonify(result)

@app.route('/api/elevaciones/<int:eid>', methods=['GET'])
def get_elevacion(eid):
    e = db.get_elevacion_by_id(eid)
    if not e:
        return jsonify({'error': 'No encontrado'}), 404
    e['fecha_emision_oficial'] = format_fecha_oficial(e.get('fecha_emision'))
    e['fecha_recibido_oficial'] = format_fecha_oficial(e.get('fecha_recibido'))
    return jsonify(e)

@app.route('/api/elevaciones/<int:eid>/toggle-impreso', methods=['POST'])
def toggle_impreso_elev(eid):
    res = db.toggle_impreso_elevacion(eid)
    return jsonify({'success': True, 'data': res})

@app.route('/api/elevaciones/<int:eid>/marcar-impreso', methods=['POST'])
def api_marcar_impreso_elev(eid):
    db.marcar_elevacion_impreso(eid)
    item = db.get_elevacion_by_id(eid)
    return jsonify({'success': True, 'item': item})

@app.route('/api/elevaciones/rango-info', methods=['GET'])
def rango_info_elev():
    info = db.get_rango_info_elevaciones()
    return jsonify(info)

@app.route('/api/elevaciones', methods=['POST'])
def save_elevacion():
    data = request.json or {}
    eid = db.save_elevacion(data)
    saved = db.get_elevacion_by_id(eid)
    return jsonify({'success': True, 'item': saved})

@app.route('/api/elevaciones/<int:eid>', methods=['DELETE'])
def delete_elevacion(eid):
    db.delete_elevacion(eid)
    return jsonify({'success': True})

@app.route('/api/elevaciones/siguiente-numero', methods=['GET'])
def next_elevacion_num():
    anio = int(request.args.get('anio', 2026))
    num = db.get_next_elevacion_numero(anio)
    cod = f"{num:04d}"
    return jsonify({'numero': num, 'codigo_formateado': cod, 'sufijo': f'-{anio}-UNHEVAL/EPG-D'})

# === VALIDACIÓN DE REG DUPLICADO ===
@app.route('/api/verificar-reg', methods=['GET'])
def verificar_reg():
    reg = request.args.get('reg', '')
    res = db.verificar_reg_duplicado(reg)
    return jsonify(res)

# === HISTORIAL DE BORRADOS / PAPELERA DE RECICLAJE ===
@app.route('/api/papelera', methods=['GET'])
def get_papelera():
    data = db.get_papelera()
    return jsonify(data)

@app.route('/api/papelera/restaurar', methods=['POST'])
def restaurar_item():
    data = request.json or {}
    tipo = data.get('tipo', 'proveido')
    item_id = int(data.get('id', 0))
    if tipo == 'proveido':
        db.restaurar_proveido(item_id)
    else:
        db.restaurar_elevacion(item_id)
    return jsonify({'success': True})

@app.route('/api/papelera/permanente', methods=['DELETE'])
def eliminar_permanente():
    data = request.json or {}
    tipo = data.get('tipo', 'proveido')
    item_id = int(data.get('id', 0))
    if tipo == 'proveido':
        db.eliminar_permanente_proveido(item_id)
    else:
        db.eliminar_permanente_elevacion(item_id)
    return jsonify({'success': True})

@app.route('/api/papelera/vaciar', methods=['POST'])
def vaciar_papelera():
    db.vaciar_papelera()
    return jsonify({'success': True})

# === SUGERENCIAS / AUTOCOMPLETE ===
@app.route('/api/sugerencias/destinatarios', methods=['GET'])
def sugerencias_dest():
    term = request.args.get('term', '')
    sug = db.get_destinatarios_sugerencias(term)
    return jsonify(sug)

@app.route('/api/estadisticas', methods=['GET'])
def estadisticas():
    stats = db.get_estadisticas()
    return jsonify(stats)

@app.route('/api/analytics', methods=['GET'])
def analytics():
    data = db.get_dashboard_analytics()
    return jsonify(data)

@app.route('/api/configuracion', methods=['GET'])
def get_configuracion():
    cfg = db.get_all_config()
    return jsonify(cfg)

@app.route('/api/configuracion', methods=['POST'])
def save_configuracion():
    data = request.json or {}
    updated = db.save_config_dict(data)
    return jsonify({'success': True, 'config': updated})

# === IMPRESIÓN ===
@app.route('/imprimir/proveido/<int:pid>')
def imprimir_proveido(pid):
    p = db.get_proveido_by_id(pid)
    if not p:
        return "Proveído no encontrado", 404
    p['fecha_emision_oficial'] = format_fecha_oficial(p.get('fecha_emision'))
    p['fecha_recibido_oficial'] = format_fecha_oficial(p.get('fecha_recibido'))
    cfg = db.get_all_config()
    return render_template('print_proveido.html', proveido=p, config=cfg)

@app.route('/imprimir/elevacion/<int:eid>')
def imprimir_elevacion(eid):
    e = db.get_elevacion_by_id(eid)
    if not e:
        return "Elevación no encontrada", 404
    e['fecha_emision_oficial'] = format_fecha_oficial(e.get('fecha_emision'))
    e['fecha_recibido_oficial'] = format_fecha_oficial(e.get('fecha_recibido'))
    cfg = db.get_all_config()
    return render_template('print_elevacion.html', elevacion=e, config=cfg)

@app.route('/imprimir/lote', methods=['POST'])
def imprimir_lote():
    data = request.json or {}
    tipo_doc = data.get('tipo', 'proveidos')
    ids = data.get('ids', [])
    
    docs = []
    if tipo_doc == 'proveidos':
        db.marcar_proveidos_impresos_lote(ids)
        for pid in ids:
            p = db.get_proveido_by_id(pid)
            if p:
                p['doc_tipo'] = 'PROVEÍDO'
                p['fecha_emision_oficial'] = format_fecha_oficial(p.get('fecha_emision'))
                p['fecha_recibido_oficial'] = format_fecha_oficial(p.get('fecha_recibido'))
                docs.append(p)
    else:
        db.marcar_elevaciones_impresas_lote(ids)
        for eid in ids:
            e = db.get_elevacion_by_id(eid)
            if e:
                e['doc_tipo'] = 'ELEVACIÓN'
                e['fecha_emision_oficial'] = format_fecha_oficial(e.get('fecha_emision'))
                e['fecha_recibido_oficial'] = format_fecha_oficial(e.get('fecha_recibido'))
                docs.append(e)
                
    cfg = db.get_all_config()
    return render_template('print_batch.html', docs=docs, config=cfg)

@app.route('/imprimir/rango', methods=['GET'])
def imprimir_rango():
    try:
        desde = max(1, int(request.args.get('desde', 1)))
        hasta = max(desde, int(request.args.get('hasta', 1)))
    except:
        return "Rango inválido. Jamás se permiten números negativos.", 400

    items = db.get_proveidos_by_range(desde, hasta)
    docs = []
    ids = []
    for p in items:
        p['doc_tipo'] = 'PROVEÍDO'
        p['fecha_emision_oficial'] = format_fecha_oficial(p.get('fecha_emision'))
        p['fecha_recibido_oficial'] = format_fecha_oficial(p.get('fecha_recibido'))
        docs.append(p)
        ids.append(p['id'])
    
    if ids:
        db.marcar_proveidos_impresos_lote(ids)

    cfg = db.get_all_config()
    return render_template('print_batch.html', docs=docs, config=cfg)

@app.route('/imprimir/elevacion-rango', methods=['GET'])
def imprimir_elevacion_rango():
    try:
        desde = max(1, int(request.args.get('desde', 1)))
        hasta = max(desde, int(request.args.get('hasta', 1)))
    except:
        return "Rango inválido. Jamás se permiten números negativos.", 400

    items = db.get_elevaciones_by_range(desde, hasta)
    docs = []
    ids = []
    for e in items:
        e['doc_tipo'] = 'ELEVACIÓN'
        e['fecha_emision_oficial'] = format_fecha_oficial(e.get('fecha_emision'))
        e['fecha_recibido_oficial'] = format_fecha_oficial(e.get('fecha_recibido'))
        docs.append(e)
        ids.append(e['id'])
    
    if ids:
        db.marcar_elevaciones_impresas_lote(ids)

    cfg = db.get_all_config()
    return render_template('print_batch.html', docs=docs, config=cfg)

# === EXPORTAR A EXCEL ===
@app.route('/api/exportar-excel', methods=['GET'])
def exportar_excel():
    filename = f"PROVEIDOS_Y_ELEVACIONES_EPG_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    tmp_dir = '/tmp' if os.environ.get('VERCEL') else os.getcwd()
    path = os.path.join(tmp_dir, filename)
    db.export_to_excel(path)
    return send_file(path, as_attachment=True, download_name=filename)

# === PLANTILLAS API ===
@app.route('/api/plantillas', methods=['GET'])
def list_plantillas():
    tipo = request.args.get('tipo', 'proveido')
    return jsonify(db.get_plantillas(tipo))

@app.route('/api/plantillas', methods=['POST'])
def api_save_plantilla():
    try:
        data = request.json or {}
        pid = db.save_plantilla(data)
        return jsonify({'success': True, 'id': pid})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/plantillas/<int:pid>', methods=['DELETE'])
def api_delete_plantilla(pid):
    try:
        db.delete_plantilla(pid)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


if __name__ == '__main__':
    print("==================================================================")
    print("  SISTEMA DE GESTIÓN DE PROVEÍDOS Y ELEVACIONES - UNHEVAL EPG")
    print("  Servidor iniciado en: http://localhost:5000")
    print("==================================================================")
    app.run(host='0.0.0.0', port=5000, debug=False)
