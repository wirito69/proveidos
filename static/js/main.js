// STATE
let currentProvPage = 1;
let currentElevPage = 1;
let currentEstadoImpresion = 'todos';
let currentEstadoImpresionElev = 'todos';
let debounceProvTimer = null;
let debounceElevTimer = null;
let debounceRegTimer = null;
let debounceRegElevTimer = null;
let catalogoDestinatarios = [];
let seleccionadosProv = new Set();
let seleccionadosElev = new Set();
let plantillasCache = {
    proveido: [],
    elevacion: []
};

// Chart instances
let chartVolumenMesInstance = null;
let chartDestinatariosInstance = null;
let chartCategoriasInstance = null;

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    cargarProveidos(1);
    cargarElevaciones(1);
    cargarSugerencias();
    cargarRangoSelects();
    cargarRangoSelectsElev();
    actualizarBadgePapelera();
    actualizarBotonModoPapelera();
    cargarPlantillasUI('proveido');
    cargarPlantillasUI('elevacion');

    // Auto-refrescar cuando el usuario vuelve a la pestaña tras imprimir
    window.addEventListener('focus', () => {
        cargarProveidos(currentProvPage);
        cargarElevaciones(currentElevPage);
        cargarRangoSelects();
        cargarRangoSelectsElev();
        actualizarBadgePapelera();
    });
});

// TAB SWITCHING
function cambiarTab(tab) {
    ['proveidos', 'elevaciones', 'estadisticas', 'configuracion', 'papelera'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        const nav = document.getElementById(`tab-nav-${t}`);
        if (el) el.classList.add('hidden');
        if (nav) nav.classList.remove('active');
    });

    const activeEl = document.getElementById(`tab-${tab}`);
    const activeNav = document.getElementById(`tab-nav-${tab}`);
    if (activeEl) activeEl.classList.remove('hidden');
    if (activeNav) activeNav.classList.add('active');

    if (tab === 'estadisticas') {
        cargarDashboardAnalytics();
    } else if (tab === 'configuracion') {
        cargarConfiguracionUI();
    } else if (tab === 'papelera') {
        cargarPapelera();
        actualizarBotonModoPapelera();
    }
}

// ========================================================
// PROVEÍDOS LOGIC & PRINT TRACKING
// ========================================================

function filtrarEstadoImpresion(estado) {
    currentEstadoImpresion = estado;
    ['todos', 'pendientes', 'impresos'].forEach(e => {
        const btn = document.getElementById(`pill-imp-${e}`);
        if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`pill-imp-${estado}`);
    if (activeBtn) activeBtn.classList.add('active');

    cargarProveidos(1);
}

function debounceBuscarProveidos() {
    clearTimeout(debounceProvTimer);
    debounceProvTimer = setTimeout(() => {
        cargarProveidos(1);
    }, 300);
}

function limpiarFiltrosProv() {
    document.getElementById('busqueda-prov').value = '';
    document.getElementById('filtro-desde-prov').value = '';
    document.getElementById('filtro-hasta-prov').value = '';
    filtrarEstadoImpresion('todos');
}

async function cargarProveidos(page = 1) {
    currentProvPage = page;
    const q = document.getElementById('busqueda-prov').value;
    const desde = document.getElementById('filtro-desde-prov').value;
    const hasta = document.getElementById('filtro-hasta-prov').value;

    const tbody = document.getElementById('tabla-proveidos-body');
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">Cargando proveídos...</td></tr>`;

    try {
        const res = await fetch(`/api/proveidos?q=${encodeURIComponent(q)}&desde=${desde}&hasta=${hasta}&estado_impresion=${currentEstadoImpresion}&page=${page}&per_page=20`);
        const data = await res.json();

        document.getElementById('badge-total-prov').innerText = data.total;
        const pendBadge = document.getElementById('badge-pendientes-count');
        if (pendBadge) pendBadge.innerText = data.total_pendientes || 0;

        renderTablaProveidos(data.items);
        renderPaginacionProveidos(data);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Error al cargar datos</td></tr>`;
    }
}

function renderTablaProveidos(items) {
    const tbody = document.getElementById('tabla-proveidos-body');
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">No se encontraron proveídos</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(p => {
        const checked = seleccionadosProv.has(p.id) ? 'checked' : '';
        const destHtml = (p.destinatarios || []).map(d => `
            <div class="font-semibold text-slate-900">${escapeHtml(d.nombre || '')}</div>
            ${d.cargo ? `<div class="text-[11px] text-slate-500 font-medium">${escapeHtml(d.cargo)}</div>` : ''}
        `).join('<div class="my-1 border-t border-slate-100"></div>');

        // Estado e indicador de impresión
        const printBadge = p.impreso === 1 ? `
            <button onclick="toggleImpreso(${p.id})" title="Impreso ${p.veces_impreso} vez/veces. Clic para marcar como pendiente" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs">
                <span>✓ Impreso</span>
                <span class="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">${p.veces_impreso}</span>
            </button>
        ` : `
            <button onclick="toggleImpreso(${p.id})" title="Pendiente de imprimir. Clic para marcar como impreso" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition shadow-2xs">
                <span>⏳ No impreso</span>
            </button>
        `;

        return `
            <tr class="hover:bg-slate-50/80 transition group">
                <td class="p-3 text-center">
                    <input type="checkbox" value="${p.id}" ${checked} onchange="toggleSelectProv(this, ${p.id})" class="rounded text-blue-600 focus:ring-blue-500">
                </td>
                <td class="py-3 px-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        N° ${p.codigo_formateado}
                    </span>
                    <div class="text-[10px] text-slate-400 mt-0.5">${p.sufijo}</div>
                </td>
                <td class="py-3 px-3 text-center">
                    ${printBadge}
                </td>
                <td class="py-3 px-4 max-w-xs">
                    ${destHtml || '<span class="text-slate-400 italic">Sin destinatario</span>'}
                </td>
                <td class="py-3 px-4 max-w-md">
                    <div class="font-medium text-slate-800 line-clamp-2 text-xs leading-relaxed" title="${escapeHtml(p.asunto)}">
                        ${escapeHtml(p.asunto)}
                    </div>
                    ${p.referencia ? `<div class="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-semibold">
                        <span class="text-slate-400">REF:</span> ${escapeHtml(p.referencia)}
                    </div>` : ''}
                    ${p.disposicion ? `<div class="text-[11px] text-blue-700/80 italic mt-0.5 truncate font-medium">"${escapeHtml(p.disposicion)}"</div>` : ''}
                </td>
                <td class="py-3 px-3 text-xs text-slate-500">
                    ${p.registro ? `<div class="font-semibold text-slate-700">REG: ${p.registro}</div>` : ''}
                    <div class="text-[11px]">Emi: ${p.fecha_emision || '-'}</div>
                    ${p.fecha_recibido ? `<div class="text-[11px] text-slate-400">Rec: ${p.fecha_recibido}</div>` : ''}
                </td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="vistaPreviaProveido(${p.id})" title="👁️ Vista Previa (Solo revisar / NO contabiliza impresión)" class="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button onclick="imprimirProveido(${p.id})" title="🖨️ Mandar a Imprimir (Abre cuadro y contabiliza)" class="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        </button>
                        <button onclick="duplicarProveido(${p.id})" title="Duplicar / Clonar en nuevo proveído" class="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                        </button>
                        <button onclick="editarProveido(${p.id})" title="Editar proveído" class="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="eliminarProveido(${p.id}, '${p.codigo_formateado}')" title="Eliminar" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPaginacionProveidos(data) {
    const info = document.getElementById('paginacion-info-prov');
    const botones = document.getElementById('paginacion-botones-prov');

    const total = data.total;
    const page = data.page;
    const perPage = data.per_page;
    const totalPages = data.total_pages;

    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    info.innerText = `Mostrando ${start} a ${end} de ${total} registros`;

    let btns = '';
    btns += `<button onclick="cargarProveidos(${page - 1})" ${page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-200"'} class="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs">Anterior</button>`;

    const maxButtons = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
        btns += `<button onclick="cargarProveidos(${p})" class="px-2.5 py-1 border rounded-md text-xs ${p === page ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white hover:bg-slate-200 border-slate-200'}">${p}</button>`;
    }

    btns += `<button onclick="cargarProveidos(${page + 1})" ${page >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-200"'} class="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs">Siguiente</button>`;

    botones.innerHTML = btns;
}

// VISTA PREVIA (SOLO REVISAR, JAMÁS CONTABILIZA IMPRESIÓN)
function vistaPreviaProveido(id) {
    window.open(`/imprimir/proveido/${id}`, '_blank');
}

// IMPRIMIR PROVEÍDO DIRECTO (ABRE CON AUTOPRINT Y DISPARA IMPRESIÓN)
function imprimirProveido(id) {
    window.open(`/imprimir/proveido/${id}?autoprint=1`, '_blank');
}

// TOGGLE MANUAL DE ESTADO IMPRESO
async function toggleImpreso(id) {
    try {
        const res = await fetch(`/api/proveidos/${id}/toggle-impreso`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            cargarProveidos(currentProvPage);
            cargarRangoSelects();
        }
    } catch (e) {
        console.error(e);
    }
}

// ========================================================
// SELECTORES DE RANGO 100% PROTEGIDOS (SIN ESCRITURA MANUAL)
// ========================================================
let rangoInfoData = null;

async function cargarRangoSelects() {
    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    if (!selDesde || !selHasta) return;

    try {
        const res = await fetch('/api/proveidos/rango-info');
        const data = await res.json();
        rangoInfoData = data;

        const valDesdeActual = selDesde.value ? parseInt(selDesde.value) : null;
        const valHastaActual = selHasta.value ? parseInt(selHasta.value) : null;

        const numeros = data.numeros || [];
        if (numeros.length === 0) {
            selDesde.innerHTML = '<option value="1">N° 1</option>';
            selHasta.innerHTML = '<option value="1">N° 1</option>';
            return;
        }

        // Generar options ordenados de menor a mayor
        const ascNumeros = [...numeros].sort((a, b) => a - b);
        const optionsHtml = ascNumeros.map(n => `<option value="${n}">N° ${n}</option>`).join('');

        selDesde.innerHTML = optionsHtml;
        selHasta.innerHTML = optionsHtml;

        const maxNum = data.max_num;
        const defaultDesde = Math.max(data.min_num, maxNum - 9);

        if (valDesdeActual && ascNumeros.includes(valDesdeActual)) {
            selDesde.value = valDesdeActual;
        } else {
            selDesde.value = defaultDesde;
        }

        if (valHastaActual && ascNumeros.includes(valHastaActual)) {
            selHasta.value = valHastaActual;
        } else {
            selHasta.value = maxNum;
        }

        // Actualizar botón de solo pendientes si hay
        const btnPend = document.getElementById('btn-preset-pendientes');
        if (btnPend) {
            if (data.pendientes_count > 0) {
                btnPend.innerHTML = `⏳ Solo Pendientes (${data.pendientes_count})`;
                btnPend.classList.remove('opacity-50', 'cursor-not-allowed');
                btnPend.disabled = false;
            } else {
                btnPend.innerHTML = `✓ Todos Impresos`;
                btnPend.classList.add('opacity-50', 'cursor-not-allowed');
                btnPend.disabled = true;
            }
        }

        actualizarContadorRango();
    } catch (e) {
        console.error('Error cargando datos de rango:', e);
    }
}

function alCambiarRangoDesde() {
    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    let d = parseInt(selDesde.value);
    let h = parseInt(selHasta.value);
    if (d > h) {
        selHasta.value = d;
    }
    actualizarContadorRango();
}

function alCambiarRangoHasta() {
    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    let d = parseInt(selDesde.value);
    let h = parseInt(selHasta.value);
    if (h < d) {
        selDesde.value = h;
    }
    actualizarContadorRango();
}

function actualizarContadorRango() {
    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    const badge = document.getElementById('rango-badge-count');
    if (!selDesde || !selHasta || !badge) return;

    let d = parseInt(selDesde.value) || 0;
    let h = parseInt(selHasta.value) || 0;

    let count = 0;
    if (rangoInfoData && rangoInfoData.numeros) {
        count = rangoInfoData.numeros.filter(n => n >= d && n <= h).length;
    } else {
        count = Math.max(0, h - d + 1);
    }

    badge.innerText = `${count} proveído${count === 1 ? '' : 's'}`;
}

function presetRango(cantidad) {
    if (!rangoInfoData) return;
    const maxNum = rangoInfoData.max_num;
    const minNum = rangoInfoData.min_num;
    const targetDesde = Math.max(minNum, maxNum - cantidad + 1);

    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    if (selDesde && selHasta) {
        selDesde.value = targetDesde;
        selHasta.value = maxNum;
        actualizarContadorRango();
    }
}

function presetSoloPendientes() {
    if (!rangoInfoData || !rangoInfoData.pendientes_min) return;
    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    if (selDesde && selHasta) {
        selDesde.value = rangoInfoData.pendientes_min;
        selHasta.value = rangoInfoData.pendientes_max;
        actualizarContadorRango();
    }
}

// IMPRESIÓN POR RANGO (USANDO LOS SELECTORES BLINDADOS)
function imprimirPorRango() {
    const selDesde = document.getElementById('rango-desde');
    const selHasta = document.getElementById('rango-hasta');
    if (!selDesde || !selHasta) return;

    let d = parseInt(selDesde.value);
    let h = parseInt(selHasta.value);

    if (isNaN(d) || isNaN(h) || d < 1 || h < 1) {
        alert("Seleccione un rango válido.");
        return;
    }

    if (d > h) {
        h = d;
        selHasta.value = h;
    }

    window.open(`/imprimir/rango?desde=${d}&hasta=${h}`, '_blank');
    
    // Auto-actualizar contador y lista
    setTimeout(() => {
        cargarProveidos(currentProvPage);
        cargarRangoSelects();
    }, 1500);
}

// DUPLICAR / CLONAR PROVEÍDO
async function duplicarProveido(id) {
    try {
        const res = await fetch(`/api/proveidos/${id}`);
        const p = await res.json();

        const resSig = await fetch('/api/proveidos/siguiente-numero');
        const sigData = await resSig.json();

        abrirModalProveido();

        document.getElementById('modal-prov-titulo').innerText = `Duplicar Proveído (Base: N° ${p.codigo_formateado})`;
        document.getElementById('badge-clonando').classList.remove('hidden');
        document.getElementById('prov-id').value = '';

        document.getElementById('prov-numero').value = sigData.numero;
        document.getElementById('prov-sufijo').value = sigData.sufijo;
        document.getElementById('prov-asunto').value = p.asunto;
        document.getElementById('prov-referencia').value = p.referencia || '';
        document.getElementById('prov-remitente-ref').value = p.remitente_ref || '';
        document.getElementById('prov-registro').value = p.registro || '';
        document.getElementById('prov-fecha-recibido').value = p.fecha_recibido || '';
        document.getElementById('prov-disposicion').value = p.disposicion || '';

        const container = document.getElementById('destinatarios-container');
        container.innerHTML = '';
        (p.destinatarios || []).forEach(d => agregarFilaDestinatario(d.nombre, d.cargo));
        if ((p.destinatarios || []).length === 0) agregarFilaDestinatario();

        const checks = new Set(p.check_opciones || []);
        document.querySelectorAll('input[name="check_prov"]').forEach(cb => {
            cb.checked = checks.has(cb.value);
        });

        setHoy('prov-fecha-emision');
    } catch (err) {
        console.error(err);
        alert("Error al duplicar proveído.");
    }
}

// VERIFICACIÓN DE REG DUPLICADO
function debounceVerificarReg() {
    clearTimeout(debounceRegTimer);
    debounceRegTimer = setTimeout(async () => {
        const regVal = document.getElementById('prov-registro').value.trim();
        const alertaBox = document.getElementById('alerta-reg-duplicado');
        const alertaTxt = document.getElementById('alerta-reg-texto');

        if (!regVal) {
            alertaBox.classList.add('hidden');
            return;
        }

        try {
            const res = await fetch(`/api/verificar-reg?reg=${encodeURIComponent(regVal)}`);
            const data = await res.json();
            if (data.existe) {
                alertaBox.classList.remove('hidden');
                alertaTxt.innerHTML = `Atención: El expediente <strong>REG ${regVal}</strong> ya tiene asignado el <strong>Proveído N° ${data.numero}</strong> emitido el ${data.fecha || ''} a nombre de <em>${data.destinatario || ''}</em>.`;
            } else {
                alertaBox.classList.add('hidden');
            }
        } catch (e) {
            console.error(e);
        }
    }, 400);
}

// ========================================================
// SISTEMA INTEGRAL DE PLANTILLAS DINÁMICAS (PROVEÍDOS Y ELEVACIONES)
// ========================================================

async function cargarPlantillasUI(tipo = 'proveido') {
    const containerId = tipo === 'proveido' ? 'plantillas-container-prov' : 'plantillas-container-elev';
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const res = await fetch(`/api/plantillas?tipo=${tipo}`);
        const data = await res.json();
        plantillasCache[tipo] = data;

        if (!data || data.length === 0) {
            container.innerHTML = `<span class="text-xs text-slate-400 italic">No hay plantillas disponibles. Haz clic en "➕ Guardar actual como Plantilla" para crear una.</span>`;
            return;
        }

        const isProv = tipo === 'proveido';
        const colorClass = isProv 
            ? 'hover:bg-blue-100 text-blue-900 border-blue-200' 
            : 'hover:bg-indigo-100 text-indigo-900 border-indigo-200';

        container.innerHTML = data.map(p => `
            <button type="button" 
                    onclick="aplicarPlantillaPorId('${tipo}', ${p.id})" 
                    title="${p.nombre}: ${escapeHtml((p.asunto || '').slice(0, 80))}..."
                    class="text-xs bg-white ${colorClass} border px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1.5 shadow-2xs hover:shadow-xs">
                <span>${p.icono || '📋'}</span>
                <span>${escapeHtml(p.nombre)}</span>
                ${p.es_predeterminada ? '' : '<span class="text-[10px] text-emerald-600 font-bold" title="Plantilla personalizada">★</span>'}
            </button>
        `).join('');

    } catch (e) {
        console.error(`Error al cargar plantillas de ${tipo}:`, e);
    }
}

function aplicarPlantillaPorId(tipo, id) {
    const lista = plantillasCache[tipo] || [];
    const p = lista.find(item => item.id === id);
    if (!p) return;

    if (tipo === 'proveido') {
        // Desmarcar checks existentes
        document.querySelectorAll('input[name="check_prov"]').forEach(cb => cb.checked = false);

        if (p.asunto) document.getElementById('prov-asunto').value = p.asunto;
        if (p.disposicion) document.getElementById('prov-disposicion').value = p.disposicion;

        // Cargar destinatarios predefinidos si los tiene
        if (Array.isArray(p.destinatarios) && p.destinatarios.length > 0) {
            const destContainer = document.getElementById('destinatarios-container');
            destContainer.innerHTML = '';
            p.destinatarios.forEach(d => agregarFilaDestinatario(d.nombre, d.cargo));
        }

        // Marcar checks
        if (Array.isArray(p.check_opciones)) {
            p.check_opciones.forEach(val => marcarCheck(val));
        }

        mostrarToast(`Plantilla "${p.nombre}" aplicada al formulario`, 'info');

    } else {
        // Elevación
        document.querySelectorAll('input[name="check_elev"]').forEach(cb => cb.checked = false);

        if (p.asunto) document.getElementById('elev-asunto').value = p.asunto;
        if (p.disposicion) document.getElementById('elev-disposicion').value = p.disposicion;
        if (p.destinatario) document.getElementById('elev-destinatario').value = p.destinatario;

        // Marcar checks elev
        if (Array.isArray(p.check_opciones)) {
            p.check_opciones.forEach(val => marcarCheckElev(val));
        }

        mostrarToast(`Plantilla "${p.nombre}" aplicada a la elevación`, 'info');
    }
}

// Mantener compatibilidad con llamadas anteriores
function aplicarPlantilla(alias) {
    const lista = plantillasCache['proveido'] || [];
    let p = null;
    if (alias === 'pago') p = lista.find(x => x.nombre.toLowerCase().includes('pago'));
    else if (alias === 'tesis') p = lista.find(x => x.nombre.toLowerCase().includes('tesis'));
    else if (alias === 'modalidad') p = lista.find(x => x.nombre.toLowerCase().includes('modalidad'));
    else if (alias === 'conocimiento') p = lista.find(x => x.nombre.toLowerCase().includes('conocimiento'));

    if (p) {
        aplicarPlantillaPorId('proveido', p.id);
    }
}

function aplicarPlantillaElev(alias) {
    const lista = plantillasCache['elevacion'] || [];
    let p = null;
    if (alias === 'tesis') p = lista.find(x => x.nombre.toLowerCase().includes('tesis'));
    else if (alias === 'grado') p = lista.find(x => x.nombre.toLowerCase().includes('grado'));
    else if (alias === 'plan') p = lista.find(x => x.nombre.toLowerCase().includes('plan'));
    else if (alias === 'resolucion') p = lista.find(x => x.nombre.toLowerCase().includes('resolución') || x.nombre.toLowerCase().includes('resolucion'));

    if (p) {
        aplicarPlantillaPorId('elevacion', p.id);
    }
}

function marcarCheck(val) {
    const el = document.querySelector(`input[name="check_prov"][value="${val}"]`);
    if (el) el.checked = true;
}

function marcarCheckElev(val) {
    const el = document.querySelector(`input[name="check_elev"][value="${val}"]`);
    if (el) el.checked = true;
}

// CREACIÓN DE NUEVA PLANTILLA
function abrirModalNuevaPlantilla(tipo = 'proveido') {
    document.getElementById('form-guardar-plantilla').reset();
    document.getElementById('plantilla-tipo-doc').value = tipo;
    
    const desc = document.getElementById('plantilla-doc-tipo-desc');
    desc.innerText = tipo === 'proveido' 
        ? 'Se creará una plantilla reutilizable para Proveídos' 
        : 'Se creará una plantilla reutilizable para Elevaciones';

    // Obtener valores actuales del formulario
    let asunto = '';
    let disposicion = '';
    let checks = [];

    if (tipo === 'proveido') {
        asunto = document.getElementById('prov-asunto').value.trim();
        disposicion = document.getElementById('prov-disposicion').value.trim();
        document.querySelectorAll('input[name="check_prov"]:checked').forEach(cb => checks.push(cb.value));
    } else {
        asunto = document.getElementById('elev-asunto').value.trim();
        disposicion = document.getElementById('elev-disposicion').value.trim();
        document.querySelectorAll('input[name="check_elev"]:checked').forEach(cb => checks.push(cb.value));
    }

    if (!asunto && !disposicion) {
        alert("Primero redacte al menos el Asunto o la Disposición en el formulario para poder guardarlo como plantilla.");
        return;
    }

    document.getElementById('plantilla-preview-asunto').innerText = asunto || '(Sin asunto redactado)';
    document.getElementById('plantilla-preview-disposicion').innerText = disposicion || '(Sin disposición redactada)';
    document.getElementById('plantilla-preview-checks').innerText = `${checks.length} seleccionada(s) (${checks.join(', ') || 'ninguna'})`;

    seleccionarIconoPlantilla('📋');
    document.getElementById('modal-guardar-plantilla').classList.remove('hidden');
    setTimeout(() => document.getElementById('plantilla-nombre').focus(), 100);
}

function cerrarModalNuevaPlantilla() {
    document.getElementById('modal-guardar-plantilla').classList.add('hidden');
}

function seleccionarIconoPlantilla(emoji) {
    document.getElementById('plantilla-icono-seleccionado').value = emoji;
    document.querySelectorAll('.emoji-picker-btn').forEach(btn => {
        if (btn.innerText.trim() === emoji) {
            btn.classList.add('bg-emerald-50', 'border-emerald-400');
        } else {
            btn.classList.remove('bg-emerald-50', 'border-emerald-400');
        }
    });
}

async function guardarNuevaPlantilla(e) {
    e.preventDefault();
    const tipo = document.getElementById('plantilla-tipo-doc').value;
    const nombre = document.getElementById('plantilla-nombre').value.trim();
    const icono = document.getElementById('plantilla-icono-seleccionado').value || '📋';

    if (!nombre) {
        alert("Por favor ingrese un nombre para la plantilla.");
        return;
    }

    let payload = {
        tipo_doc: tipo,
        nombre: nombre,
        icono: icono
    };

    if (tipo === 'proveido') {
        payload.asunto = document.getElementById('prov-asunto').value.trim();
        payload.disposicion = document.getElementById('prov-disposicion').value.trim();
        
        let dests = [];
        document.querySelectorAll('#destinatarios-container > div').forEach(row => {
            const nom = row.querySelector('.dest-nombre')?.value.trim();
            const car = row.querySelector('.dest-cargo')?.value.trim();
            if (nom || car) dests.push({ nombre: nom, cargo: car });
        });
        payload.destinatarios = dests;

        let checks = [];
        document.querySelectorAll('input[name="check_prov"]:checked').forEach(cb => checks.push(cb.value));
        payload.check_opciones = checks;

    } else {
        payload.asunto = document.getElementById('elev-asunto').value.trim();
        payload.disposicion = document.getElementById('elev-disposicion').value.trim();
        payload.destinatario = document.getElementById('elev-destinatario').value.trim();

        let checks = [];
        document.querySelectorAll('input[name="check_elev"]:checked').forEach(cb => checks.push(cb.value));
        payload.check_opciones = checks;
    }

    try {
        const res = await fetch('/api/plantillas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (resData.success) {
            cerrarModalNuevaPlantilla();
            await cargarPlantillasUI(tipo);
            mostrarToast(`Plantilla "${nombre}" guardada con éxito`, 'success');
        } else {
            alert("Error al guardar plantilla: " + (resData.error || 'Desconocido'));
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al guardar la plantilla.");
    }
}

// ADMINISTRACIÓN DE PLANTILLAS
let currentGestionTipo = 'proveido';

async function abrirModalGestionPlantillas(tipo = 'proveido') {
    currentGestionTipo = tipo;
    const modal = document.getElementById('modal-gestion-plantillas');
    const desc = document.getElementById('gestion-plantillas-desc');
    desc.innerText = tipo === 'proveido' 
        ? 'Catálogo de plantillas para Proveídos (Predeterminadas y Personalizadas)' 
        : 'Catálogo de plantillas para Elevaciones (Predeterminadas y Personalizadas)';

    modal.classList.remove('hidden');
    await refrescarListaGestionPlantillas();
}

function cerrarModalGestionPlantillas() {
    document.getElementById('modal-gestion-plantillas').classList.add('hidden');
}

async function refrescarListaGestionPlantillas() {
    const listaContainer = document.getElementById('gestion-plantillas-lista');
    listaContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Cargando catálogo...</div>`;

    try {
        const res = await fetch(`/api/plantillas?tipo=${currentGestionTipo}`);
        const plantillas = await res.json();
        plantillasCache[currentGestionTipo] = plantillas;

        if (plantillas.length === 0) {
            listaContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No hay plantillas registradas.</div>`;
            return;
        }

        listaContainer.innerHTML = plantillas.map(p => `
            <div class="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1 flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-base">${p.icono || '📋'}</span>
                        <h4 class="text-sm font-bold text-slate-900 truncate">${escapeHtml(p.nombre)}</h4>
                        ${p.es_predeterminada 
                            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">🔒 Predeterminada</span>' 
                            : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✏️ Personalizada</span>'
                        }
                    </div>
                    <p class="text-xs text-slate-600 line-clamp-1 italic">${escapeHtml(p.asunto || p.disposicion || 'Sin texto')}</p>
                    <div class="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Casillas: <strong>${(p.check_opciones || []).length}</strong></span>
                        ${p.destinatarios && p.destinatarios.length > 0 ? `<span>• Destinatarios: <strong>${p.destinatarios.length}</strong></span>` : ''}
                        ${p.destinatario ? `<span>• Para: <strong>${escapeHtml(p.destinatario)}</strong></span>` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button type="button" 
                            onclick="aplicarPlantillaPorId('${currentGestionTipo}', ${p.id}); cerrarModalGestionPlantillas();"
                            class="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition flex items-center gap-1">
                        <span>⚡</span> Usar
                    </button>
                    ${!p.es_predeterminada ? `
                        <button type="button" 
                                onclick="eliminarPlantillaUsuario(${p.id}, '${escapeHtml(p.nombre)}')"
                                class="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition flex items-center gap-1">
                            <span>🗑️</span> Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        listaContainer.innerHTML = `<div class="p-6 text-center text-rose-500 text-xs">Error al cargar plantillas.</div>`;
    }
}

async function eliminarPlantillaUsuario(id, nombre) {
    if (!confirm(`¿Está seguro de eliminar la plantilla personalizada "${nombre}"?`)) return;

    try {
        const res = await fetch(`/api/plantillas/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            mostrarToast(`Plantilla "${nombre}" eliminada`, 'info');
            await refrescarListaGestionPlantillas();
            await cargarPlantillasUI(currentGestionTipo);
        } else {
            alert("No se pudo eliminar la plantilla.");
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión al eliminar plantilla.");
    }
}


// BATCH SELECTION PROV
function toggleSelectProv(cb, id) {
    if (cb.checked) seleccionadosProv.add(id);
    else seleccionadosProv.delete(id);
    actualizarBarraBatchProv();
}

function toggleSelectAllProv(cb) {
    const checkboxes = document.querySelectorAll('#tabla-proveidos-body input[type="checkbox"]');
    checkboxes.forEach(c => {
        c.checked = cb.checked;
        const id = parseInt(c.value);
        if (cb.checked) seleccionadosProv.add(id);
        else seleccionadosProv.delete(id);
    });
    actualizarBarraBatchProv();
}

function actualizarBarraBatchProv() {
    const bar = document.getElementById('batch-prov-bar');
    const count = document.getElementById('batch-prov-count');
    if (seleccionadosProv.size > 0) {
        bar.classList.remove('hidden');
        count.innerText = `${seleccionadosProv.size} seleccionados`;
    } else {
        bar.classList.add('hidden');
    }
}

async function imprimirSeleccionadosProv() {
    if (seleccionadosProv.size === 0) return;
    const ids = Array.from(seleccionadosProv);
    const res = await fetch('/imprimir/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'proveidos', ids: ids })
    });
    const html = await res.text();
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => cargarProveidos(currentProvPage), 1500);
}

// ========================================================
// ELEVACIONES LOGIC & PRINT TRACKING
// ========================================================

function filtrarEstadoImpresionElev(estado) {
    currentEstadoImpresionElev = estado;
    document.querySelectorAll('.filter-pill-elev').forEach(p => {
        p.classList.remove('active', 'bg-indigo-600', 'text-white');
        p.classList.add('text-slate-600');
    });

    const activePill = document.getElementById(`pill-imp-elev-${estado}`);
    if (activePill) {
        activePill.classList.add('active');
        activePill.classList.remove('text-slate-600');
    }

    cargarElevaciones(1);
}

function debounceBuscarElevaciones() {
    clearTimeout(debounceElevTimer);
    debounceElevTimer = setTimeout(() => {
        cargarElevaciones(1);
    }, 300);
}

function limpiarFiltrosElev() {
    document.getElementById('busqueda-elev').value = '';
    document.getElementById('filtro-desde-elev').value = '';
    document.getElementById('filtro-hasta-elev').value = '';
    filtrarEstadoImpresionElev('todos');
}

async function cargarElevaciones(page = 1) {
    currentElevPage = page;
    const q = document.getElementById('busqueda-elev').value;
    const desde = document.getElementById('filtro-desde-elev').value;
    const hasta = document.getElementById('filtro-hasta-elev').value;

    const tbody = document.getElementById('tabla-elevaciones-body');
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">Cargando elevaciones...</td></tr>`;

    try {
        const res = await fetch(`/api/elevaciones?q=${encodeURIComponent(q)}&desde=${desde}&hasta=${hasta}&estado_impresion=${currentEstadoImpresionElev}&page=${page}&per_page=20`);
        const data = await res.json();

        document.getElementById('badge-total-elev').innerText = data.total;
        const pendBadge = document.getElementById('badge-pendientes-count-elev');
        if (pendBadge) pendBadge.innerText = data.total_pendientes || 0;

        renderTablaElevaciones(data.items);
        renderPaginacionElevaciones(data);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Error al cargar datos</td></tr>`;
    }
}

function renderTablaElevaciones(items) {
    const tbody = document.getElementById('tabla-elevaciones-body');
    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">No se encontraron elevaciones</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(e => {
        const checked = seleccionadosElev.has(e.id) ? 'checked' : '';

        // Estado e indicador de impresión
        const printBadge = e.impreso === 1 ? `
            <button onclick="toggleImpresoElev(${e.id})" title="Impreso ${e.veces_impreso} vez/veces. Clic para marcar como pendiente" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs">
                <span>✓ Impreso</span>
                <span class="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">${e.veces_impreso}</span>
            </button>
        ` : `
            <button onclick="toggleImpresoElev(${e.id})" title="Pendiente de imprimir. Clic para marcar como impreso" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition shadow-2xs">
                <span>⏳ No impreso</span>
            </button>
        `;

        return `
            <tr class="hover:bg-slate-50/80 transition group">
                <td class="p-3 text-center">
                    <input type="checkbox" value="${e.id}" ${checked} onchange="toggleSelectElev(this, ${e.id})" class="rounded text-indigo-600 focus:ring-indigo-500">
                </td>
                <td class="py-3 px-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        N° ${e.codigo_formateado}
                    </span>
                    <div class="text-[10px] text-slate-400 mt-0.5">${e.sufijo}</div>
                </td>
                <td class="py-3 px-3 text-center">
                    ${printBadge}
                </td>
                <td class="py-3 px-4 max-w-xs font-semibold text-slate-900 text-xs">
                    ${escapeHtml(e.destinatario || '')}
                </td>
                <td class="py-3 px-4 max-w-md">
                    <div class="font-medium text-slate-800 line-clamp-2 text-xs leading-relaxed" title="${escapeHtml(e.asunto)}">
                        ${escapeHtml(e.asunto)}
                    </div>
                    ${e.referencia ? `<div class="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-semibold">
                        <span class="text-slate-400">REF:</span> ${escapeHtml(e.referencia)}
                    </div>` : ''}
                    ${e.remitente_ref ? `<div class="text-[11px] text-indigo-700/80 mt-0.5 truncate font-medium">${escapeHtml(e.remitente_ref)}</div>` : ''}
                    ${e.disposicion ? `<div class="text-[11px] text-indigo-700/80 italic mt-0.5 truncate font-medium">"${escapeHtml(e.disposicion)}"</div>` : ''}
                </td>
                <td class="py-3 px-3 text-xs text-slate-500">
                    ${e.registro ? `<div class="font-semibold text-slate-700">REG: ${e.registro}</div>` : ''}
                    <div class="text-[11px]">Emi: ${e.fecha_emision || '-'}</div>
                    ${e.fecha_recibido ? `<div class="text-[11px] text-slate-400">Rec: ${e.fecha_recibido}</div>` : ''}
                </td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="vistaPreviaElevacion(${e.id})" title="👁️ Vista Previa (Solo revisar / NO contabiliza impresión)" class="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        <button onclick="imprimirElevacion(${e.id})" title="🖨️ Mandar a Imprimir (Abre cuadro y contabiliza)" class="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        </button>
                        <button onclick="duplicarElevacion(${e.id})" title="Duplicar / Clonar en nueva elevación" class="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                        </button>
                        <button onclick="editarElevacion(${e.id})" title="Editar elevación" class="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="eliminarElevacion(${e.id}, '${e.codigo_formateado}')" title="Eliminar" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function vistaPreviaElevacion(id) {
    window.open(`/imprimir/elevacion/${id}`, '_blank');
}

function imprimirElevacion(id) {
    window.open(`/imprimir/elevacion/${id}?autoprint=1`, '_blank');
}

async function toggleImpresoElev(id) {
    try {
        const res = await fetch(`/api/elevaciones/${id}/toggle-impreso`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            cargarElevaciones(currentElevPage);
            cargarRangoSelectsElev();
        }
    } catch (e) {
        console.error(e);
    }
}

// SELECTORES DE RANGO PARA ELEVACIONES (100% PROTEGIDOS)
async function cargarRangoSelectsElev() {
    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    if (!selDesde || !selHasta) return;

    try {
        const res = await fetch('/api/elevaciones/rango-info');
        const data = await res.json();
        rangoInfoDataElev = data;

        const valDesdeActual = selDesde.value ? parseInt(selDesde.value) : null;
        const valHastaActual = selHasta.value ? parseInt(selHasta.value) : null;

        const numeros = data.numeros || [];
        if (numeros.length === 0) {
            selDesde.innerHTML = '<option value="1">N° 1</option>';
            selHasta.innerHTML = '<option value="1">N° 1</option>';
            return;
        }

        const ascNumeros = [...numeros].sort((a, b) => a - b);
        const optionsHtml = ascNumeros.map(n => `<option value="${n}">N° ${n}</option>`).join('');

        selDesde.innerHTML = optionsHtml;
        selHasta.innerHTML = optionsHtml;

        const maxNum = data.max_num;
        const defaultDesde = Math.max(data.min_num, maxNum - 9);

        if (valDesdeActual && ascNumeros.includes(valDesdeActual)) {
            selDesde.value = valDesdeActual;
        } else {
            selDesde.value = defaultDesde;
        }

        if (valHastaActual && ascNumeros.includes(valHastaActual)) {
            selHasta.value = valHastaActual;
        } else {
            selHasta.value = maxNum;
        }

        // Actualizar botón de solo pendientes si hay
        const btnPend = document.getElementById('btn-preset-pendientes-elev');
        if (btnPend) {
            if (data.pendientes_count > 0) {
                btnPend.innerHTML = `⏳ Solo Pendientes (${data.pendientes_count})`;
                btnPend.classList.remove('opacity-50', 'cursor-not-allowed');
                btnPend.disabled = false;
            } else {
                btnPend.innerHTML = `✓ Todas Impresas`;
                btnPend.classList.add('opacity-50', 'cursor-not-allowed');
                btnPend.disabled = true;
            }
        }

        actualizarContadorRangoElev();
    } catch (e) {
        console.error('Error cargando datos de rango elevaciones:', e);
    }
}

function alCambiarRangoDesdeElev() {
    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    let d = parseInt(selDesde.value);
    let h = parseInt(selHasta.value);
    if (d > h) {
        selHasta.value = d;
    }
    actualizarContadorRangoElev();
}

function alCambiarRangoHastaElev() {
    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    let d = parseInt(selDesde.value);
    let h = parseInt(selHasta.value);
    if (h < d) {
        selDesde.value = h;
    }
    actualizarContadorRangoElev();
}

function actualizarContadorRangoElev() {
    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    const badge = document.getElementById('rango-badge-count-elev');
    if (!selDesde || !selHasta || !badge) return;

    let d = parseInt(selDesde.value) || 0;
    let h = parseInt(selHasta.value) || 0;

    let count = 0;
    if (rangoInfoDataElev && rangoInfoDataElev.numeros) {
        count = rangoInfoDataElev.numeros.filter(n => n >= d && n <= h).length;
    } else {
        count = Math.max(0, h - d + 1);
    }

    badge.innerText = `${count} elevación${count === 1 ? '' : 'es'}`;
}

function presetRangoElev(cantidad) {
    if (!rangoInfoDataElev) return;
    const maxNum = rangoInfoDataElev.max_num;
    const minNum = rangoInfoDataElev.min_num;
    const targetDesde = Math.max(minNum, maxNum - cantidad + 1);

    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    if (selDesde && selHasta) {
        selDesde.value = targetDesde;
        selHasta.value = maxNum;
        actualizarContadorRangoElev();
    }
}

function presetSoloPendientesElev() {
    if (!rangoInfoDataElev || !rangoInfoDataElev.pendientes_min) return;
    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    if (selDesde && selHasta) {
        selDesde.value = rangoInfoDataElev.pendientes_min;
        selHasta.value = rangoInfoDataElev.pendientes_max;
        actualizarContadorRangoElev();
    }
}

function imprimirPorRangoElev() {
    const selDesde = document.getElementById('rango-desde-elev');
    const selHasta = document.getElementById('rango-hasta-elev');
    if (!selDesde || !selHasta) return;

    let d = parseInt(selDesde.value);
    let h = parseInt(selHasta.value);

    if (isNaN(d) || isNaN(h) || d < 1 || h < 1) {
        alert("Seleccione un rango válido.");
        return;
    }

    if (d > h) {
        h = d;
        selHasta.value = h;
    }

    window.open(`/imprimir/elevacion-rango?desde=${d}&hasta=${h}`, '_blank');
    
    setTimeout(() => {
        cargarElevaciones(currentElevPage);
        cargarRangoSelectsElev();
    }, 1500);
}

// DUPLICAR / CLONAR ELEVACIÓN
async function duplicarElevacion(id) {
    try {
        const res = await fetch(`/api/elevaciones/${id}`);
        const e = await res.json();

        const resSig = await fetch('/api/elevaciones/siguiente-numero');
        const sigData = await resSig.json();

        abrirModalElevacion();

        document.getElementById('modal-elev-titulo').innerText = `Duplicar Elevación (Base: N° ${e.codigo_formateado})`;
        document.getElementById('badge-clonando-elev').classList.remove('hidden');
        document.getElementById('elev-id').value = '';

        document.getElementById('elev-numero').value = sigData.numero;
        document.getElementById('elev-sufijo').value = sigData.sufijo;
        document.getElementById('elev-destinatario').value = e.destinatario || 'CONSEJO DIRECTIVO DE LA ESCUELA DE POSGRADO';
        document.getElementById('elev-asunto').value = e.asunto;
        document.getElementById('elev-referencia').value = e.referencia || '';
        document.getElementById('elev-remitente-ref').value = e.remitente_ref || '';
        document.getElementById('elev-registro').value = e.registro || '';
        document.getElementById('elev-fecha-recibido').value = e.fecha_recibido || '';
        document.getElementById('elev-disposicion').value = e.disposicion || '';

        const checks = new Set(e.check_opciones || []);
        document.querySelectorAll('input[name="check_elev"]').forEach(cb => {
            cb.checked = checks.has(cb.value);
        });

        setHoy('elev-fecha-emision');
    } catch (err) {
        console.error(err);
        alert("Error al duplicar elevación.");
    }
}

function renderPaginacionElevaciones(data) {
    const info = document.getElementById('paginacion-info-elev');
    const botones = document.getElementById('paginacion-botones-elev');

    const total = data.total;
    const page = data.page;
    const perPage = data.per_page;
    const totalPages = data.total_pages;

    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end = Math.min(page * perPage, total);

    info.innerText = `Mostrando ${start} a ${end} de ${total} registros`;

    let btns = '';
    btns += `<button onclick="cargarElevaciones(${page - 1})" ${page <= 1 ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-200"'} class="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs">Anterior</button>`;

    const maxButtons = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
        btns += `<button onclick="cargarElevaciones(${p})" class="px-2.5 py-1 border rounded-md text-xs ${p === page ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white hover:bg-slate-200 border-slate-200'}">${p}</button>`;
    }

    btns += `<button onclick="cargarElevaciones(${page + 1})" ${page >= totalPages ? 'disabled class="opacity-40 cursor-not-allowed"' : 'class="hover:bg-slate-200"'} class="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-xs">Siguiente</button>`;

    botones.innerHTML = btns;
}

function toggleSelectElev(cb, id) {
    if (cb.checked) seleccionadosElev.add(id);
    else seleccionadosElev.delete(id);
    actualizarBarraBatchElev();
}

function toggleSelectAllElev(cb) {
    const checkboxes = document.querySelectorAll('#tabla-elevaciones-body input[type="checkbox"]');
    checkboxes.forEach(c => {
        c.checked = cb.checked;
        const id = parseInt(c.value);
        if (cb.checked) seleccionadosElev.add(id);
        else seleccionadosElev.delete(id);
    });
    actualizarBarraBatchElev();
}

function actualizarBarraBatchElev() {
    const bar = document.getElementById('batch-elev-bar');
    const count = document.getElementById('batch-elev-count');
    if (seleccionadosElev.size > 0) {
        bar.classList.remove('hidden');
        count.innerText = `${seleccionadosElev.size} seleccionados`;
    } else {
        bar.classList.add('hidden');
    }
}

async function imprimirSeleccionadosElev() {
    if (seleccionadosElev.size === 0) return;
    const ids = Array.from(seleccionadosElev);
    const res = await fetch('/imprimir/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'elevaciones', ids: ids })
    });
    const html = await res.text();
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
}

// ========================================================
// MODAL & FORM PROVEÍDO
// ========================================================

async function abrirModalProveido(id = null) {
    document.getElementById('form-proveido').reset();
    document.getElementById('prov-id').value = '';
    document.getElementById('destinatarios-container').innerHTML = '';
    document.getElementById('alerta-reg-duplicado').classList.add('hidden');
    document.getElementById('badge-clonando').classList.add('hidden');
    
    document.querySelectorAll('input[name="check_prov"]').forEach(cb => cb.checked = false);
    cargarPlantillasUI('proveido');

    if (id) {
        document.getElementById('modal-prov-titulo').innerText = 'Editar Proveído';
        try {
            const res = await fetch(`/api/proveidos/${id}`);
            const p = await res.json();

            document.getElementById('prov-id').value = p.id;
            document.getElementById('prov-numero').value = p.numero;
            document.getElementById('prov-anio').value = p.anio;
            document.getElementById('prov-sufijo').value = p.sufijo;
            document.getElementById('prov-asunto').value = p.asunto;
            document.getElementById('prov-referencia').value = p.referencia || '';
            document.getElementById('prov-remitente-ref').value = p.remitente_ref || '';
            document.getElementById('prov-registro').value = p.registro || '';
            document.getElementById('prov-fecha-recibido').value = p.fecha_recibido || '';
            document.getElementById('prov-fecha-emision').value = p.fecha_emision || '';
            document.getElementById('prov-disposicion').value = p.disposicion || '';

            const dests = p.destinatarios || [];
            if (dests.length === 0) {
                agregarFilaDestinatario();
            } else {
                dests.forEach(d => agregarFilaDestinatario(d.nombre, d.cargo));
            }

            const checks = new Set(p.check_opciones || []);
            document.querySelectorAll('input[name="check_prov"]').forEach(cb => {
                cb.checked = checks.has(cb.value);
            });
        } catch (e) {
            console.error(e);
        }
    } else {
        document.getElementById('modal-prov-titulo').innerText = 'Registrar Nuevo Proveído';
        try {
            const res = await fetch('/api/proveidos/siguiente-numero');
            const data = await res.json();
            document.getElementById('prov-numero').value = data.numero;
            document.getElementById('prov-sufijo').value = data.sufijo;
        } catch (e) {
            console.error(e);
        }
        setHoy('prov-fecha-emision');
        agregarFilaDestinatario();
    }

    document.getElementById('modal-proveido').classList.remove('hidden');
}

function cerrarModalProveido() {
    document.getElementById('modal-proveido').classList.add('hidden');
}

function agregarFilaDestinatario(nombre = '', cargo = '') {
    const container = document.getElementById('destinatarios-container');
    const rowId = 'dest-row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5);

    const div = document.createElement('div');
    div.id = rowId;
    div.className = "flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200";
    div.innerHTML = `
        <div class="flex-1">
            <input type="text" list="destinatarios-sugerencias" placeholder="Nombre completo del destinatario..." value="${escapeHtml(nombre)}" oninput="autocompletarCargo(this)" class="dest-nombre w-full text-xs font-semibold border border-slate-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="flex-1">
            <input type="text" placeholder="Cargo oficial o área..." value="${escapeHtml(cargo)}" class="dest-cargo w-full text-xs border border-slate-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="button" onclick="eliminarFilaDestinatario('${rowId}')" title="Quitar este destinatario" class="text-slate-400 hover:text-red-500 p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    container.appendChild(div);
}

function eliminarFilaDestinatario(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
}

function autocompletarCargo(inputEl) {
    const val = inputEl.value.trim().toUpperCase();
    const match = catalogoDestinatarios.find(d => d.nombre.toUpperCase() === val);
    if (match && match.cargo) {
        const row = inputEl.closest('.flex');
        const cargoInput = row.querySelector('.dest-cargo');
        if (cargoInput && !cargoInput.value) {
            cargoInput.value = match.cargo;
        }
    }
}

async function guardarProveido(event) {
    event.preventDefault();

    const destRows = document.querySelectorAll('#destinatarios-container > div');
    const destinatarios = [];
    destRows.forEach(r => {
        const nom = r.querySelector('.dest-nombre').value.trim();
        const car = r.querySelector('.dest-cargo').value.trim();
        if (nom || car) {
            destinatarios.push({ nombre: nom, cargo: car });
        }
    });

    if (destinatarios.length === 0) {
        alert("Por favor agregue al menos un destinatario.");
        return;
    }

    const checkOpciones = [];
    document.querySelectorAll('input[name="check_prov"]:checked').forEach(cb => {
        checkOpciones.push(cb.value);
    });

    const data = {
        id: document.getElementById('prov-id').value || null,
        numero: Math.max(1, parseInt(document.getElementById('prov-numero').value)),
        anio: Math.max(2020, parseInt(document.getElementById('prov-anio').value)),
        sufijo: document.getElementById('prov-sufijo').value,
        destinatarios: destinatarios,
        asunto: document.getElementById('prov-asunto').value,
        referencia: document.getElementById('prov-referencia').value,
        remitente_ref: document.getElementById('prov-remitente-ref').value,
        registro: document.getElementById('prov-registro').value,
        fecha_recibido: document.getElementById('prov-fecha-recibido').value,
        fecha_emision: document.getElementById('prov-fecha-emision').value,
        disposicion: document.getElementById('prov-disposicion').value,
        check_opciones: checkOpciones
    };

    try {
        const res = await fetch('/api/proveidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            cerrarModalProveido();
            cargarProveidos(currentProvPage);
            cargarSugerencias();
        } else {
            alert("Error al guardar: " + (result.error || "Desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión al guardar.");
    }
}

function editarProveido(id) {
    abrirModalProveido(id);
}

function eliminarProveido(id, cod) {
    solicitarBorrado('proveido', id, `Proveído N° ${cod}`);
}

// ========================================================
// MODAL & FORM ELEVACIÓN
// ========================================================

function debounceVerificarRegElev() {
    clearTimeout(debounceRegElevTimer);
    debounceRegElevTimer = setTimeout(async () => {
        const regVal = document.getElementById('elev-registro').value.trim();
        const alertaBox = document.getElementById('alerta-reg-duplicado-elev');
        const alertaTxt = document.getElementById('alerta-reg-texto-elev');

        if (!regVal) {
            alertaBox.classList.add('hidden');
            return;
        }

        try {
            const res = await fetch(`/api/verificar-reg?reg=${encodeURIComponent(regVal)}`);
            const data = await res.json();
            if (data.existe) {
                alertaBox.classList.remove('hidden');
                alertaTxt.innerHTML = `Atención: El expediente <strong>REG ${regVal}</strong> ya tiene asignado un <strong>${data.tipo} N° ${data.numero}</strong> emitido el ${data.fecha || ''} a nombre de <em>${data.destinatario || ''}</em>.`;
            } else {
                alertaBox.classList.add('hidden');
            }
        } catch (e) {
            console.error(e);
        }
    }, 400);
}

async function abrirModalElevacion(id = null) {
    document.getElementById('form-elevacion').reset();
    document.getElementById('elev-id').value = '';
    const badgeClon = document.getElementById('badge-clonando-elev');
    if (badgeClon) badgeClon.classList.add('hidden');
    const alertaBox = document.getElementById('alerta-reg-duplicado-elev');
    if (alertaBox) alertaBox.classList.add('hidden');
    document.querySelectorAll('input[name="check_elev"]').forEach(cb => cb.checked = false);
    cargarPlantillasUI('elevacion');

    if (id) {
        document.getElementById('modal-elev-titulo').innerText = 'Editar Elevación';
        try {
            const res = await fetch(`/api/elevaciones/${id}`);
            const e = await res.json();

            document.getElementById('elev-id').value = e.id;
            document.getElementById('elev-numero').value = e.numero;
            document.getElementById('elev-anio').value = e.anio;
            document.getElementById('elev-sufijo').value = e.sufijo;
            document.getElementById('elev-destinatario').value = e.destinatario;
            document.getElementById('elev-asunto').value = e.asunto;
            document.getElementById('elev-referencia').value = e.referencia || '';
            document.getElementById('elev-remitente-ref').value = e.remitente_ref || '';
            document.getElementById('elev-registro').value = e.registro || '';
            document.getElementById('elev-fecha-recibido').value = e.fecha_recibido || '';
            document.getElementById('elev-fecha-emision').value = e.fecha_emision || '';
            document.getElementById('elev-disposicion').value = e.disposicion || '';

            const checks = new Set(e.check_opciones || []);
            document.querySelectorAll('input[name="check_elev"]').forEach(cb => {
                cb.checked = checks.has(cb.value);
            });
        } catch (err) {
            console.error(err);
        }
    } else {
        document.getElementById('modal-elev-titulo').innerText = 'Registrar Nueva Elevación';
        try {
            const res = await fetch('/api/elevaciones/siguiente-numero');
            const data = await res.json();
            document.getElementById('elev-numero').value = data.numero;
            document.getElementById('elev-sufijo').value = data.sufijo;
        } catch (err) {
            console.error(err);
        }
        document.getElementById('elev-destinatario').value = 'CONSEJO DIRECTIVO DE LA ESCUELA DE POSGRADO';
        setHoy('elev-fecha-emision');
    }

    document.getElementById('modal-elevacion').classList.remove('hidden');
}

function cerrarModalElevacion() {
    document.getElementById('modal-elevacion').classList.add('hidden');
}

async function guardarElevacion(event) {
    event.preventDefault();

    const checkOpciones = [];
    document.querySelectorAll('input[name="check_elev"]:checked').forEach(cb => {
        checkOpciones.push(cb.value);
    });

    const data = {
        id: document.getElementById('elev-id').value || null,
        numero: Math.max(1, parseInt(document.getElementById('elev-numero').value)),
        anio: Math.max(2020, parseInt(document.getElementById('elev-anio').value)),
        sufijo: document.getElementById('elev-sufijo').value,
        destinatario: document.getElementById('elev-destinatario').value,
        asunto: document.getElementById('elev-asunto').value,
        referencia: document.getElementById('elev-referencia').value,
        remitente_ref: document.getElementById('elev-remitente-ref').value,
        registro: document.getElementById('elev-registro').value,
        fecha_recibido: document.getElementById('elev-fecha-recibido').value,
        fecha_emision: document.getElementById('elev-fecha-emision').value,
        disposicion: document.getElementById('elev-disposicion').value,
        check_opciones: checkOpciones
    };

    try {
        const res = await fetch('/api/elevaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            cerrarModalElevacion();
            cargarElevaciones(currentElevPage);
            cargarRangoSelectsElev();
        } else {
            alert("Error al guardar: " + (result.error || "Desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("Error al guardar.");
    }
}

function editarElevacion(id) {
    abrirModalElevacion(id);
}

function eliminarElevacion(id, cod) {
    solicitarBorrado('elevacion', id, `Elevación N° ${cod}`);
}

// ========================================================
// DASHBOARD EJECUTIVO & CHART.JS (TOMA DE DECISIONES)
// ========================================================

async function cargarDashboardAnalytics() {
    try {
        const res = await fetch('/api/analytics');
        const data = await res.json();

        document.getElementById('dash-total-prov').innerText = data.total_proveidos;
        document.getElementById('dash-total-elev').innerText = data.total_elevaciones;
        document.getElementById('dash-total-reg').innerText = data.total_expedientes;
        document.getElementById('dash-total-impresos').innerText = data.total_impresos || 0;
        document.getElementById('dash-total-pendientes').innerText = data.total_pendientes || 0;

        // Render Gráfico 1: Volumen por mes
        const ctxVol = document.getElementById('chart-volumen-mes').getContext('2d');
        if (chartVolumenMesInstance) chartVolumenMesInstance.destroy();
        chartVolumenMesInstance = new Chart(ctxVol, {
            type: 'bar',
            data: {
                labels: data.labels_meses,
                datasets: [{
                    label: 'Proveídos Emitidos',
                    data: data.valores_meses,
                    backgroundColor: 'rgba(37, 99, 235, 0.75)',
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Render Gráfico 2: Top Destinatarios
        const ctxDest = document.getElementById('chart-destinatarios').getContext('2d');
        if (chartDestinatariosInstance) chartDestinatariosInstance.destroy();
        chartDestinatariosInstance = new Chart(ctxDest, {
            type: 'bar',
            data: {
                labels: data.labels_destinatarios,
                datasets: [{
                    label: 'Cantidad de Trámites',
                    data: data.valores_destinatarios,
                    backgroundColor: 'rgba(79, 70, 229, 0.75)',
                    borderColor: 'rgb(79, 70, 229)',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                    y: { grid: { display: false } }
                }
            }
        });

        // Render Gráfico 3: Categorías
        const ctxCat = document.getElementById('chart-categorias').getContext('2d');
        if (chartCategoriasInstance) chartCategoriasInstance.destroy();
        chartCategoriasInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: ['Gestión Económica (Pagos)', 'Tesis y Grados', 'Docencia y Clases', 'Otros'],
                datasets: [{
                    data: [
                        data.categorias_tramite.Gestion_Economica_Pagos,
                        data.categorias_tramite.Tesis_y_Grados,
                        data.categorias_tramite.Docencia_y_Clases,
                        data.categorias_tramite.Otros_Tramites
                    ],
                    backgroundColor: [
                        '#2563eb',
                        '#4f46e5',
                        '#059669',
                        '#94a3b8'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, font: { size: 10 } }
                    }
                }
            }
        });

    } catch (err) {
        console.error(err);
    }
}

// SUGERENCIAS & HELPERS
async function cargarSugerencias() {
    try {
        const res = await fetch('/api/sugerencias/destinatarios');
        catalogoDestinatarios = await res.json();

        const dl = document.getElementById('destinatarios-sugerencias');
        dl.innerHTML = catalogoDestinatarios.map(d => `<option value="${escapeHtml(d.nombre)}">${escapeHtml(d.cargo || '')}</option>`).join('');
    } catch (err) {
        console.error(err);
    }
}

function setHoy(inputId) {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById(inputId).value = hoy;
}

function setDestinatarioElev(texto) {
    document.getElementById('elev-destinatario').value = texto;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ========================================================
// CONFIGURACIÓN E INDICACIONES DE IMPRESIÓN
// ========================================================

async function cargarConfiguracionUI() {
    try {
        const res = await fetch('/api/configuracion');
        const cfg = await res.json();

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined) el.value = val;
        };

        setVal('cfg-margen-top', cfg.margen_top || 20);
        setVal('cfg-margen-bottom', cfg.margen_bottom || 18);
        setVal('cfg-margen-left', cfg.margen_left || 22);
        setVal('cfg-margen-right', cfg.margen_right || 18);
        setVal('cfg-altura-firma', cfg.altura_firma || 140);

        setVal('cfg-anio-activo', cfg.anio_activo || 2026);
        setVal('cfg-lugar-defecto', cfg.lugar_defecto || 'Cayhuayna');
        setVal('cfg-sufijo-defecto', cfg.sufijo_defecto || '-2026-UNHEVAL/EPG-D');

        actualizarPreviewA4();
    } catch (e) {
        console.error('Error cargando configuración:', e);
    }
}

function actualizarPreviewA4() {
    const top = document.getElementById('cfg-margen-top')?.value || 20;
    const bottom = document.getElementById('cfg-margen-bottom')?.value || 18;
    const left = document.getElementById('cfg-margen-left')?.value || 22;
    const right = document.getElementById('cfg-margen-right')?.value || 18;

    const resumen = document.getElementById('preview-resumen-margenes');
    if (resumen) {
        resumen.innerText = `Arr: ${top}mm | Izq: ${left}mm | Der: ${right}mm | Aba: ${bottom}mm`;
    }

    const miniHoja = document.getElementById('mini-hoja-a4');
    if (miniHoja) {
        const scale = 0.55;
        miniHoja.style.paddingTop = `${Math.round(top * scale)}px`;
        miniHoja.style.paddingBottom = `${Math.round(bottom * scale)}px`;
        miniHoja.style.paddingLeft = `${Math.round(left * scale)}px`;
        miniHoja.style.paddingRight = `${Math.round(right * scale)}px`;
    }
}

async function guardarConfiguracion() {
    const payload = {
        margen_top: document.getElementById('cfg-margen-top')?.value || 20,
        margen_bottom: document.getElementById('cfg-margen-bottom')?.value || 18,
        margen_left: document.getElementById('cfg-margen-left')?.value || 22,
        margen_right: document.getElementById('cfg-margen-right')?.value || 18,
        altura_firma: document.getElementById('cfg-altura-firma')?.value || 140,
        anio_activo: document.getElementById('cfg-anio-activo')?.value || 2026,
        lugar_defecto: document.getElementById('cfg-lugar-defecto')?.value || 'Cayhuayna',
        sufijo_defecto: document.getElementById('cfg-sufijo-defecto')?.value || '-2026-UNHEVAL/EPG-D'
    };

    try {
        const res = await fetch('/api/configuracion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert('✓ Configuración guardada correctamente.\n\nTodos los proveídos y elevaciones utilizarán estos márgenes al momento de imprimirse.');
            actualizarPreviewA4();
        }
    } catch (e) {
        console.error(e);
        alert('Error guardando la configuración.');
    }
}

function restablecerConfiguracionDefecto() {
    if (!confirm('¿Desea restablecer los márgenes y parámetros al estándar oficial UNHEVAL EPG?')) return;

    document.getElementById('cfg-margen-top').value = 20;
    document.getElementById('cfg-margen-bottom').value = 18;
    document.getElementById('cfg-margen-left').value = 22;
    document.getElementById('cfg-margen-right').value = 18;
    document.getElementById('cfg-altura-firma').value = 140;

    document.getElementById('cfg-anio-activo').value = 2026;
    document.getElementById('cfg-lugar-defecto').value = 'Cayhuayna';
    document.getElementById('cfg-sufijo-defecto').value = '-2026-UNHEVAL/EPG-D';

    guardarConfiguracion();
}

// Auto-refrescar listas al volver a la pestaña tras imprimir
window.addEventListener('focus', () => {
    const tabProv = document.getElementById('tab-proveidos');
    if (tabProv && !tabProv.classList.contains('hidden') && typeof cargarProveidos === 'function') {
        cargarProveidos(currentProvPage);
        if (typeof cargarRangoSelects === 'function') cargarRangoSelects();
    }
    actualizarBadgePapelera();
});

// ========================================================
// CONFIRMACIÓN DE BORRADO Y PAPELERA DE RECICLAJE (30 DÍAS)
// ========================================================

let elementoAEliminar = null;

function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
    if (typeof tipo === 'number') {
        duracion = tipo;
        tipo = 'info';
    }
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }
    const icon = tipo === 'success' ? '✅' : (tipo === 'trash' ? '🗑️' : (tipo === 'info' ? '⚡' : '💡'));
    const toast = document.createElement('div');
    toast.className = 'bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-md pointer-events-auto flex items-center gap-2 transform transition-all duration-300 translate-y-3 opacity-0';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(mensaje)}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-3', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-3');
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

function solicitarBorrado(tipo, id, cod) {
    const omitirConfirmacion = localStorage.getItem('omitir_confirmacion_papelera') === 'true';
    if (omitirConfirmacion) {
        ejecutarMoverPapelera(tipo, id, cod);
        return;
    }

    elementoAEliminar = { tipo, id, cod };
    const modal = document.getElementById('modal-confirmar-borrado');
    const titulo = document.getElementById('confirm-borrado-titulo');
    const mensaje = document.getElementById('confirm-borrado-mensaje');
    const btn = document.getElementById('btn-ejecutar-borrado');

    if (titulo) titulo.innerText = `¿Mover ${cod} a la Papelera?`;
    if (mensaje) {
        mensaje.innerHTML = `El documento <strong>${escapeHtml(cod)}</strong> será retirado de la lista activa y trasladado a la papelera de reciclaje durante <strong>30 días (1 mes)</strong> por si necesita recuperarlo.`;
    }

    const checkNoPreguntar = document.getElementById('check-no-volver-a-preguntar');
    if (checkNoPreguntar) checkNoPreguntar.checked = false;

    if (btn) {
        btn.onclick = function() {
            if (!elementoAEliminar) return;
            const targetTipo = elementoAEliminar.tipo;
            const targetId = elementoAEliminar.id;
            const targetCod = elementoAEliminar.cod;

            if (checkNoPreguntar && checkNoPreguntar.checked) {
                localStorage.setItem('omitir_confirmacion_papelera', 'true');
                actualizarBotonModoPapelera();
            }

            cerrarModalConfirmarBorrado();
            ejecutarMoverPapelera(targetTipo, targetId, targetCod);
        };
    }

    if (modal) modal.classList.remove('hidden');
}

async function ejecutarMoverPapelera(tipo, id, cod) {
    try {
        const endpoint = tipo === 'proveido'
            ? `/api/proveidos/${id}`
            : `/api/elevaciones/${id}`;
        const res = await fetch(endpoint, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            if (tipo === 'proveido') {
                cargarProveidos(currentProvPage);
                cargarRangoSelects();
            } else {
                cargarElevaciones(currentElevPage);
                cargarRangoSelectsElev();
            }
            actualizarBadgePapelera();
            mostrarToast(`✓ ${cod || 'Documento'} movido a la papelera (30 días)`, 'trash');
        } else {
            alert("No se pudo mover a la papelera: " + (data.error || "Desconocido"));
        }
    } catch (e) {
        console.error("Error al mover a la papelera:", e);
        alert("Error de conexión al mover a la papelera.");
    }
}

function alternarModoConfirmacionPapelera() {
    const actual = localStorage.getItem('omitir_confirmacion_papelera') === 'true';
    const nuevo = !actual;
    localStorage.setItem('omitir_confirmacion_papelera', nuevo ? 'true' : 'false');
    actualizarBotonModoPapelera();
    mostrarToast(nuevo ? "⚡ Modo rápido: Borrado directo con 1 clic (sin preguntas)" : "🛡️ Modo seguro: Se pedirá confirmación antes de mover a papelera");
}

function actualizarBotonModoPapelera() {
    const omitir = localStorage.getItem('omitir_confirmacion_papelera') === 'true';
    const txt = document.getElementById('txt-modo-papelera');
    const icon = document.getElementById('icon-modo-papelera');
    const btn = document.getElementById('btn-toggle-modo-papelera');
    if (txt && icon && btn) {
        if (omitir) {
            icon.innerText = "⚡";
            txt.innerText = "Borrado directo (1 clic)";
            btn.className = "px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1.5";
            btn.title = "Actualmente: Mover directo sin preguntar. Haz clic para activar confirmación previa.";
        } else {
            icon.innerText = "🛡️";
            txt.innerText = "Pide confirmación";
            btn.className = "px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5";
            btn.title = "Actualmente: Muestra ventana de confirmación. Haz clic para activar borrado directo con 1 clic.";
        }
    }
}

function cerrarModalConfirmarBorrado() {
    const modal = document.getElementById('modal-confirmar-borrado');
    if (modal) modal.classList.add('hidden');
    elementoAEliminar = null;
}

async function cargarPapelera() {
    try {
        const res = await fetch('/api/papelera');
        const data = await res.json();

        const lista = document.getElementById('papelera-lista');
        const emptyState = document.getElementById('papelera-vacia');
        const badgeContador = document.getElementById('papelera-contador-badge');
        const btnVaciar = document.getElementById('btn-vaciar-papelera');

        const total = data.total || 0;
        if (badgeContador) badgeContador.innerText = `${total} elemento${total === 1 ? '' : 's'}`;
        actualizarBadgePapelera(total);

        if (!data.items || data.items.length === 0) {
            if (lista) lista.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            if (btnVaciar) btnVaciar.classList.add('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (btnVaciar) btnVaciar.classList.remove('hidden');

        lista.innerHTML = data.items.map(item => {
            const isProv = item.tipo_doc === 'PROVEÍDO';
            const badgeTipo = isProv 
                ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">PROVEÍDO</span>'
                : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">ELEVACIÓN</span>';
            
            const destHtml = isProv 
                ? (item.destinatarios || []).map(d => d.nombre).join(', ') || item.destinatario_principal || '-'
                : item.destinatario || '-';

            const dias = item.dias_restantes !== undefined ? item.dias_restantes : 30;
            let diasBadge = '';
            if (dias > 15) {
                diasBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">⏳ ${dias} días restantes</span>`;
            } else if (dias > 5) {
                diasBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">⚠️ ${dias} días restantes</span>`;
            } else {
                diasBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">🚨 ${dias} días restantes</span>`;
            }

            const tipoParam = isProv ? 'proveido' : 'elevacion';
            const codNom = `${item.tipo_doc} N° ${item.codigo_formateado}`;

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            ${badgeTipo}
                            <span class="font-bold text-slate-900 text-xs">N° ${item.codigo_formateado}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${item.sufijo || ''}</div>
                    </td>
                    <td class="py-3 px-4 max-w-sm">
                        <div class="text-xs font-semibold text-slate-800 truncate" title="${escapeHtml(destHtml)}">
                            ${escapeHtml(destHtml)}
                        </div>
                        <div class="text-xs text-slate-600 line-clamp-2 mt-0.5" title="${escapeHtml(item.asunto || '')}">
                            ${escapeHtml(item.asunto || '')}
                        </div>
                    </td>
                    <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <div class="font-medium text-slate-700">${item.fecha_eliminacion || '-'}</div>
                    </td>
                    <td class="py-3 px-4 text-center whitespace-nowrap">
                        ${diasBadge}
                    </td>
                    <td class="py-3 px-4 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1.5">
                            <button onclick="restaurarElemento('${tipoParam}', ${item.id}, '${escapeHtml(codNom)}')" 
                                    class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition flex items-center gap-1"
                                    title="Restaurar documento a la lista activa">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                Restaurar
                            </button>
                            <button onclick="eliminarPermanente('${tipoParam}', ${item.id}, '${escapeHtml(codNom)}')" 
                                    class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                    title="Eliminar definitivamente de forma permanente">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Error al cargar la papelera:", e);
    }
}

async function actualizarBadgePapelera(conteo = null) {
    const badge = document.getElementById('badge-total-papelera');
    if (!badge) return;
    try {
        let total = conteo;
        if (total === null) {
            const res = await fetch('/api/papelera');
            const data = await res.json();
            total = data.total || 0;
        }
        badge.innerText = total;
        if (total > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (e) {
        console.error(e);
    }
}

async function restaurarElemento(tipo, id, cod) {
    try {
        const res = await fetch('/api/papelera/restaurar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, id })
        });
        const data = await res.json();
        if (data.success) {
            cargarPapelera();
            cargarProveidos(currentProvPage);
            cargarElevaciones(currentElevPage);
            cargarRangoSelects();
        }
    } catch (e) {
        console.error(e);
        alert("Error al restaurar.");
    }
}

async function eliminarPermanente(tipo, id, cod) {
    if (!confirm(`¿Está seguro de eliminar DEFINITIVAMENTE ${cod}?\n\nEsta acción es irreversible y borrará el documento permanentemente de la base de datos.`)) return;

    try {
        const res = await fetch('/api/papelera/permanente', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, id })
        });
        const data = await res.json();
        if (data.success) {
            cargarPapelera();
        }
    } catch (e) {
        console.error(e);
        alert("Error al eliminar permanentemente.");
    }
}

async function solicitarVaciarPapelera() {
    if (!confirm("⚠️ ¿Está seguro de VACIAR TODA la papelera de reciclaje?\n\nTodos los documentos en la papelera se borrarán permanentemente sin posibilidad de recuperación.")) return;

    try {
        const res = await fetch('/api/papelera/vaciar', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            cargarPapelera();
            actualizarBadgePapelera(0);
        }
    } catch (e) {
        console.error(e);
        alert("Error al vaciar la papelera.");
    }
}

