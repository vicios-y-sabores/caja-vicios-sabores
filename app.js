// --- SISTEMA DE LOGIN Y ROLES ---
let usuarioActual = JSON.parse(sessionStorage.getItem('vicios_usuarioActivo'));

if (!usuarioActual) window.location.href = 'index.html'; 

function cerrarSesion() {
    if(confirm("¿Seguro que deseas cerrar sesión?")) {
        sessionStorage.removeItem('vicios_usuarioActivo');
        window.location.href = 'index.html';
    }
}

// --- BASE DE DATOS LOCAL ---
let estadoCaja = JSON.parse(localStorage.getItem('vicios_estadoCaja')) || { abierta: false, cajaChica: 0, siguienteFicha: 1 };
let ventasHoy = JSON.parse(localStorage.getItem('vicios_ventasHoy')) || [];
let gastosHoy = JSON.parse(localStorage.getItem('vicios_gastosHoy')) || [];
let historialDias = JSON.parse(localStorage.getItem('vicios_historialDias')) || [];
let clientesDB = JSON.parse(localStorage.getItem('vicios_clientesDB')) || []; 
let inventarioDB = JSON.parse(localStorage.getItem('vicios_inventarioDB')) || {};

let pedidoActual = []; 
let totalActual = 0;
let cfgActual = null; let nombreItemBase = ""; let precioBase = 0; let diaVisualizando = null;

function actualizarTituloFicha() {
    let nroFicha = estadoCaja.siguienteFicha || 1;
    let titulo = document.getElementById('titulo-ticket');
    if (titulo) titulo.innerHTML = `🛒 Ticket Actual <span style="color:#ff4500;">(Ficha #${nroFicha})</span>`;
}

function cargarClientes() {
    let dl = document.getElementById('lista-clientes');
    if (dl) { dl.innerHTML = ''; clientesDB.forEach(c => { let opt = document.createElement('option'); opt.value = c; dl.appendChild(opt); }); }
}

// Inyección de Modales
document.getElementById('modales-container').innerHTML = `
    <div class="modal-overlay" id="modal-apertura">
        <div class="modal" style="max-width: 400px; text-align: center;">
            <h2>☀️ Nuevo Día de Trabajo</h2>
            <p style="margin-bottom: 15px;">¿Con cuánto dinero (sencillo) estás abriendo la caja hoy?</p>
            <input type="number" id="input-caja-chica" class="input-grande" placeholder="Ej: 150">
            <button class="btn-accion" onclick="abrirCaja()">Abrir Caja</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-dinamico">
        <div class="modal">
            <h2 id="modal-dinamico-titulo">Detalles</h2>
            <div id="modal-dinamico-contenido"></div>
            
            <p style="margin-top: 15px; font-weight: bold; color: #333;">Tipo de consumo inicial:</p>
            <select id="modal-dinamico-tipo-consumo" class="form-select" style="margin-bottom: 10px;">
                <option value="Mesa">🍽️ Para Servirse (Mesa)</option>
                <option value="Llevar">🛍️ Para Llevar</option>
            </select>

            <p style="margin-top: 5px; font-weight: bold; color: #333;">Nota especial (Opcional):</p>
            <input type="text" id="modal-dinamico-nota" class="input-grande" placeholder="Ej: Bien dorado, sin llajua...">
            
            <button class="btn-accion" onclick="confirmarItemDinamico()">✔️ Agregar al Pedido</button>
            <button class="btn-accion btn-cancelar" onclick="cerrarModales()">❌ Cancelar</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-qr-flotante" onclick="cerrarQRFlotante()">
        <div class="modal" style="max-width: 450px; text-align: center; background: #fff;">
            <h2 style="color:#25d366; border-bottom:none; margin-bottom:5px;">📱 Escanea para Pagar</h2>
            <img src="img/qr.jpg" alt="QR" style="width: 100%; max-width: 350px; border: 4px solid #25d366; border-radius: 15px;">
            <p style="margin-top:20px; color:#000; font-weight:bold; font-size:1.5rem;">A cobrar: <span id="qr-total-flotante" style="color:#ff0000; font-size:2rem;">0 Bs.</span></p>
            <button class="btn-accion" style="margin-top:15px; background:#333;" onclick="cerrarQRFlotante()">Ocultar QR</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-gastos">
        <div class="modal" style="max-width: 500px;">
            <h2>💸 Registro de Gastos</h2>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" id="input-gasto-detalle" class="input-grande" style="flex:2; margin-bottom:0;" placeholder="Detalle (Ej: Servilletas)">
                <input type="number" id="input-gasto-monto" class="input-grande" style="flex:1; margin-bottom:0;" placeholder="Monto (Bs)">
                <button class="btn-accion" style="margin-top:0; width:auto; padding:10px;" onclick="agregarGasto()">➕</button>
            </div>
            <div id="lista-gastos" style="overflow-y: auto; max-height: 200px; border:1px solid #ccc; padding:10px; border-radius:5px; margin-bottom:15px;"></div>
            <h3 style="text-align:right; color:#dc3545;">Total Gastos: <span id="total-gastos-display">0</span> Bs.</h3>
            <button class="btn-accion btn-cancelar" onclick="cerrarModales()">Cerrar</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-inventario">
        <div class="modal" style="max-width: 500px;">
            <h2>📦 Control de Stock del Día</h2>
            <p style="color:#555; margin-bottom:10px; font-family:sans-serif; font-size:0.9rem;">Deja en blanco si no quieres limitar un producto.</p>
            <div id="lista-inventario" style="overflow-y:auto; max-height: 400px; padding:5px; margin-bottom:15px;"></div>
            <button class="btn-accion" onclick="guardarInventario()">💾 Guardar Stock</button>
            <button class="btn-accion btn-cancelar" onclick="cerrarModales()">Cerrar</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-cocina">
        <div class="modal" style="max-width: 700px; background: #eee;">
            <h2>🧑‍🍳 Pedidos Pendientes en Cocina</h2>
            <div id="lista-cocina" style="overflow-y:auto; max-height: 60vh; padding:10px;"></div>
            <button class="btn-accion btn-cancelar" onclick="cerrarModales()">Volver a Caja</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-cierre">
        <div class="modal" style="max-width: 800px; width: 95%; max-height: 95vh; padding: 20px; display: flex; flex-direction: column;">
            <div id="area-impresion" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <h2 id="titulo-modal-cierre">📊 Reporte de Caja</h2>
                <h3 id="fecha-reporte" style="text-align:center; color:#555; margin-bottom:10px;"></h3>
                
                <div class="caja-info"><span>Caja Chica Inicial:</span> <span id="resumen-caja-chica">0 Bs.</span></div>
                <div class="caja-info" style="background: #e6f7ff;"><span>Ingresos Efectivo (Ventas):</span> <span id="resumen-ventas-efectivo" style="color:#005580;">0 Bs.</span></div>
                <div class="caja-info" style="background: #e6ffe6;"><span>Ingresos QR (Banco):</span> <span id="resumen-qr" style="color:#008000;">0 Bs.</span></div>
                <div class="caja-info" style="background: #ffe6e6; color:#dc3545;"><span>Gastos del Día:</span> <span id="resumen-gastos-cierre">- 0 Bs.</span></div>
                
                <div class="caja-info resaltado"><span>EFECTIVO FINAL EN CAJÓN:</span> <span id="resumen-cajon-final" style="color:#ff4500; font-size:1.3rem;">0 Bs.</span></div>

                <h3 style="margin-top: 10px; color:#d35400;">Resumen de Platos Vendidos:</h3>
                <div id="resumen-platos" style="font-family: sans-serif; font-size: 0.95rem; color: #333; margin-bottom: 15px; background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #ff4500;"></div>

                <div class="contenedor-tabla">
                    <table class="tabla-historial" id="tabla-ventas-hoy">
                        <thead><tr><th>Hora</th><th>Detalle</th><th>Método</th><th>Total</th><th class="col-accion">Acción</th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
            <div class="modal-botones" style="display: flex; gap: 10px; margin-top: 15px; flex-shrink: 0;">
                <button class="btn-accion btn-cancelar" onclick="cerrarModales()" style="flex:1;">Volver</button>
                <button class="btn-accion" id="btn-wa-cierre" onclick="enviarWhatsAppYGuardar()" style="flex:2; background: #ffaa00; color: black;">📩 Cerrar Caja y PDF</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="modal-historial-dias">
        <div class="modal" style="max-width: 600px;">
            <h2>📅 Historial de Días Cerrados</h2>
            <div id="lista-dias" style="overflow-y: auto; max-height: 400px; padding: 5px;"></div>
            <button class="btn-accion btn-cancelar" onclick="cerrarModales()" style="margin-top: 15px;">Cerrar</button>
        </div>
    </div>
`;

window.onload = function() {
    if (usuarioActual.rol === "cajero") {
        document.querySelector('.btn-gastos').style.display = 'none';
        document.querySelector('button[onclick="abrirHistorialDias()"]').style.display = 'none';
        document.querySelector('button[onclick="abrirInventario()"]').style.display = 'none';
        document.querySelector('.caja-chica-display').onclick = null;
        document.querySelector('.caja-chica-display').style.cursor = 'default';
    }
    cargarClientes(); 

    if (!estadoCaja.abierta) document.getElementById('modal-apertura').style.display = 'flex';
    else { actualizarHeaderCaja(); actualizarTituloFicha(); }
};

function actualizarHeaderCaja() { document.getElementById('lbl-caja-chica-header').innerText = `Caja Chica: ${estadoCaja.cajaChica} Bs`; }
function abrirCaja() {
    let monto = parseFloat(document.getElementById('input-caja-chica').value) || 0;
    estadoCaja = { abierta: true, cajaChica: monto, siguienteFicha: 1 };
    ventasHoy = []; gastosHoy = []; inventarioDB = {};
    localStorage.setItem('vicios_estadoCaja', JSON.stringify(estadoCaja));
    localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy));
    localStorage.setItem('vicios_gastosHoy', JSON.stringify(gastosHoy));
    localStorage.setItem('vicios_inventarioDB', JSON.stringify(inventarioDB));
    actualizarHeaderCaja(); actualizarTituloFicha(); cerrarModales();
}

const itemsTrackeables = [
    "Alitas 4 Pz", "Alitas 6 Pz", "Alitas 8 Pz",
    "Pecho", "Ala", "Pierna", "Entre Pierna",
    "Silpancho de Res", "Silpancho con 2 Huevos", "Milanesa"
];

function abrirInventario() {
    let html = '';
    itemsTrackeables.forEach(item => {
        let val = inventarioDB[item] !== undefined ? inventarioDB[item] : '';
        html += `<div class="inv-fila"><span style="color:black; font-weight:bold;">${item}</span>
        <input type="number" id="inv-${item.replace(/[^a-zA-Z0-9]/g, '')}" value="${val}" placeholder="∞"></div>`;
    });
    document.getElementById('lista-inventario').innerHTML = html;
    document.getElementById('modal-inventario').style.display = 'flex';
}

function guardarInventario() {
    itemsTrackeables.forEach(item => {
        let val = document.getElementById(`inv-${item.replace(/[^a-zA-Z0-9]/g, '')}`).value;
        if(val !== "") inventarioDB[item] = parseInt(val); else delete inventarioDB[item];
    });
    localStorage.setItem('vicios_inventarioDB', JSON.stringify(inventarioDB));
    alert("📦 Stock de presas actualizado"); cerrarModales();
}

function getInventarioRequerido(pedido) {
    let req = { 'Pecho': 0, 'Ala': 0, 'Pierna': 0, 'Entre Pierna': 0, 'Cualq_PA': 0, 'Cualq_PEP': 0 };
    pedido.forEach(i => {
        let n = i.nombre; let c = i.cantidad;
        if (n.includes('Pecho y Ala')) { req['Pecho']+=c; req['Ala']+=c; }
        else if (n.includes('Pierna y Entre Pierna')) { req['Pierna']+=c; req['Entre Pierna']+=c; }
        else if (n.includes('Cualquiera (Pecho o Ala)')) req['Cualq_PA']+=c;
        else if (n.includes('Cualquiera (Pierna o Entre Pierna)')) req['Cualq_PEP']+=c;
        else if (n.includes('(Pecho)')) req['Pecho']+=c;
        else if (n.includes('(Ala)')) req['Ala']+=c;
        else if (n.includes('(Entre Pierna)')) req['Entre Pierna']+=c;
        else if (n.includes('(Pierna)')) req['Pierna']+=c;
        else {
            let base = i.nombreBase || n.split(' (')[0];
            if(itemsTrackeables.includes(base)) { req[base] = (req[base] || 0) + c; }
        }
    });
    return req;
}

function comprobarStock(nombreBase, nombreFinal, cantAAgregar) {
    let tempPedido = JSON.parse(JSON.stringify(pedidoActual));
    let idx = tempPedido.findIndex(i => i.nombre === nombreFinal);
    if(idx > -1) tempPedido[idx].cantidad += cantAAgregar; else tempPedido.push({nombreBase, nombre: nombreFinal, cantidad: cantAAgregar});
    let req = getInventarioRequerido(tempPedido);

    for(let item of itemsTrackeables) {
        if(req[item] > 0 && inventarioDB[item] !== undefined) {
            if(req[item] > inventarioDB[item]) { alert(`⚠️ STOCK INSUFICIENTE DE: ${item}.\nEn cocina quedan ${inventarioDB[item]}, estás intentando pedir ${req[item]}.`); return false; }
        }
    }
    if(req['Cualq_PA'] > 0) {
        let dispPecho = (inventarioDB['Pecho'] !== undefined ? inventarioDB['Pecho'] : 9999) - (req['Pecho']||0);
        let dispAla = (inventarioDB['Ala'] !== undefined ? inventarioDB['Ala'] : 9999) - (req['Ala']||0);
        if(dispPecho + dispAla < req['Cualq_PA']) { alert(`⚠️ NO HAY PRESAS SUFICIENTES para cubrir el pedido al azar de (Pecho o Ala).`); return false; }
    }
    if(req['Cualq_PEP'] > 0) {
        let dispPierna = (inventarioDB['Pierna'] !== undefined ? inventarioDB['Pierna'] : 9999) - (req['Pierna']||0);
        let dispEP = (inventarioDB['Entre Pierna'] !== undefined ? inventarioDB['Entre Pierna'] : 9999) - (req['Entre Pierna']||0);
        if(dispPierna + dispEP < req['Cualq_PEP']) { alert(`⚠️ NO HAY PRESAS SUFICIENTES para cubrir el pedido al azar de (Pierna o Entre Pierna).`); return false; }
    }
    return true;
}

function descontarStockPagado(items) {
    let req = getInventarioRequerido(items);
    for(let item of itemsTrackeables) { if(req[item] > 0 && inventarioDB[item] !== undefined) inventarioDB[item] -= req[item]; }
    
    if(req['Cualq_PA'] > 0) {
        for(let i=0; i<req['Cualq_PA']; i++) {
            let p = inventarioDB['Pecho'] !== undefined ? inventarioDB['Pecho'] : 9999;
            let a = inventarioDB['Ala'] !== undefined ? inventarioDB['Ala'] : 9999;
            if(p >= a && inventarioDB['Pecho'] !== undefined) inventarioDB['Pecho']--; else if(inventarioDB['Ala'] !== undefined) inventarioDB['Ala']--;
        }
    }
    if(req['Cualq_PEP'] > 0) {
        for(let i=0; i<req['Cualq_PEP']; i++) {
            let p = inventarioDB['Pierna'] !== undefined ? inventarioDB['Pierna'] : 9999;
            let ep = inventarioDB['Entre Pierna'] !== undefined ? inventarioDB['Entre Pierna'] : 9999;
            if(p >= ep && inventarioDB['Pierna'] !== undefined) inventarioDB['Pierna']--; else if(inventarioDB['Entre Pierna'] !== undefined) inventarioDB['Entre Pierna']--;
        }
    }
    localStorage.setItem('vicios_inventarioDB', JSON.stringify(inventarioDB));
}

function restaurarStockAnulado(items) {
    let req = getInventarioRequerido(items);
    for(let item of itemsTrackeables) { if(req[item] > 0 && inventarioDB[item] !== undefined) inventarioDB[item] += req[item]; }
    if(req['Cualq_PA'] > 0) {
        for(let i=0; i<req['Cualq_PA']; i++) {
            let p = inventarioDB['Pecho'] !== undefined ? inventarioDB['Pecho'] : 9999; let a = inventarioDB['Ala'] !== undefined ? inventarioDB['Ala'] : 9999;
            if(p <= a && inventarioDB['Pecho'] !== undefined) inventarioDB['Pecho']++; else if(inventarioDB['Ala'] !== undefined) inventarioDB['Ala']++;
        }
    }
    if(req['Cualq_PEP'] > 0) {
        for(let i=0; i<req['Cualq_PEP']; i++) {
            let p = inventarioDB['Pierna'] !== undefined ? inventarioDB['Pierna'] : 9999; let ep = inventarioDB['Entre Pierna'] !== undefined ? inventarioDB['Entre Pierna'] : 9999;
            if(p <= ep && inventarioDB['Pierna'] !== undefined) inventarioDB['Pierna']++; else if(inventarioDB['Entre Pierna'] !== undefined) inventarioDB['Entre Pierna']++;
        }
    }
    localStorage.setItem('vicios_inventarioDB', JSON.stringify(inventarioDB));
}

function abrirModalDinamico(nombre, precioBaseParam, config) {
    cfgActual = config; nombreItemBase = nombre; precioBase = precioBaseParam;
    document.getElementById('modal-dinamico-titulo').innerText = nombre;
    document.getElementById('modal-dinamico-nota').value = "";
    document.getElementById('modal-dinamico-tipo-consumo').value = "Mesa"; 
    let contenidoHTML = "";

    if (config.tipo === 'alitas') {
        if (config.piezas === 4) {
            contenidoHTML += `<p style="font-weight:bold; margin-bottom:5px; color:#333;">Salsa:</p><select class="form-select" id="alita-salsa-1"><option value="BBQ">Salsa BBQ</option><option value="Miel Mostaza">Salsa Miel Mostaza</option><option value="Picante">Salsa Picante</option></select>`;
        } else {
            let mitad = config.piezas / 2;
            contenidoHTML += `<p style="font-weight:bold; margin-bottom:10px; color:#ff0000;">⚠️ Distribuir exactamente ${config.piezas} alitas:</p>
                <div class="fila-alitas"><input type="number" id="alita-qty-1" class="input-grande" value="${mitad}" min="0" max="${config.piezas}"><span style="color:#000; font-weight:bold;">Alitas:</span><select class="form-select" id="alita-salsa-1"><option>BBQ</option><option selected>Miel Mostaza</option><option>Picante</option></select></div>
                <div class="fila-alitas"><input type="number" id="alita-qty-2" class="input-grande" value="${mitad}" min="0" max="${config.piezas}"><span style="color:#000; font-weight:bold;">Alitas:</span><select class="form-select" id="alita-salsa-2"><option>Picante</option><option selected>BBQ</option><option>Miel Mostaza</option></select></div>`;
        }
    } 
    else if (config.tipo === 'presa') contenidoHTML += `<select class="form-select" id="cmb-presa">${config.opciones.map(op => `<option value="${op}">${op}</option>`).join('')}</select>`;
    else if (config.tipo === 'refresco') contenidoHTML += `<select class="form-select" id="cmb-refresco"><option>Maracuyá</option><option>Limón</option><option>Canela</option><option>Tumbo</option></select>`;
    else if (config.tipo === 'gaseosa') contenidoHTML += `<select class="form-select" id="cmb-gaseosa"><option>Coca Cola</option><option>Fanta</option><option>Sprite</option></select>`;
    
    document.getElementById('modal-dinamico-contenido').innerHTML = contenidoHTML;
    document.getElementById('modal-dinamico').style.display = 'flex';
}

function confirmarItemDinamico() {
    let detalle = ""; let nombreFinal = nombreItemBase;
    let tipoConsumo = document.getElementById('modal-dinamico-tipo-consumo').value;

    if (cfgActual.tipo === 'alitas') {
        if (cfgActual.piezas === 4) detalle = `Salsa: ${document.getElementById('alita-salsa-1').value}`;
        else {
            let q1 = parseInt(document.getElementById('alita-qty-1').value) || 0; let s1 = document.getElementById('alita-salsa-1').value;
            let q2 = parseInt(document.getElementById('alita-qty-2').value) || 0; let s2 = document.getElementById('alita-salsa-2').value;
            if (q1 + q2 !== cfgActual.piezas) { alert(`❌ ERROR: Debes sumar ${cfgActual.piezas} alitas.`); return; }
            if (s1 === s2) detalle = `Salsa: ${s1}`; else { let p = []; if(q1>0) p.push(`${q1} de ${s1}`); if(q2>0) p.push(`${q2} de ${s2}`); detalle = p.join(' y '); }
        }
    } 
    else if (cfgActual.tipo === 'presa') nombreFinal = `${nombreItemBase.split(' (')[0]} (${document.getElementById('cmb-presa').value})`;
    else if (cfgActual.tipo === 'refresco') nombreFinal += ` (${document.getElementById('cmb-refresco').value})`;
    else if (cfgActual.tipo === 'gaseosa') nombreFinal += ` (${document.getElementById('cmb-gaseosa').value})`;

    let notaInput = document.getElementById('modal-dinamico-nota').value.trim();
    if (notaInput) detalle += (detalle ? " | " : "") + notaInput;

    agregarAlPedido(nombreItemBase, nombreFinal, precioBase, detalle, tipoConsumo);
    cerrarModales();
}

function cerrarModales() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
function abrirQRFlotante() { if(totalActual>0){document.getElementById('qr-total-flotante').innerText=totalActual+' Bs.';document.getElementById('modal-qr-flotante').style.display='flex';}else{alert("Agrega productos al ticket.");}}
function cerrarQRFlotante() { document.getElementById('modal-qr-flotante').style.display = 'none'; }

function agregarAlPedido(nombreBaseParam, nombreMostrar, precio, nota, tipoConsumo) {
    if(!comprobarStock(nombreBaseParam, nombreMostrar, 1)) return;
    let index = pedidoActual.findIndex(i => i.nombre === nombreMostrar && i.nota === nota && i.tipoConsumo === tipoConsumo);
    if (index > -1) pedidoActual[index].cantidad++; 
    else pedidoActual.push({ nombreBase: nombreBaseParam, nombre: nombreMostrar, precio, nota, tipoConsumo, cantidad: 1, id: Date.now() + Math.random(), entregado: false });
    renderizarTicket();
}

window.cambiarTipoConsumoItem = function(id, nuevoTipo) { let index = pedidoActual.findIndex(i => i.id === id); if (index > -1) pedidoActual[index].tipoConsumo = nuevoTipo; }
function quitarDelPedido(id) { let index = pedidoActual.findIndex(i => i.id === id); if (index > -1) { pedidoActual[index].cantidad--; if (pedidoActual[index].cantidad <= 0) pedidoActual.splice(index, 1); } renderizarTicket(); }
function vaciarTicket() { if (pedidoActual.length > 0 && confirm("🗑️ ¿Vaciar todo el ticket?")) { pedidoActual = []; renderizarTicket(); } }

function renderizarTicket() {
    const lista = document.getElementById('lista-ticket'); lista.innerHTML = ''; totalActual = 0;
    pedidoActual.forEach(item => {
        let subtotal = item.cantidad * item.precio; totalActual += subtotal;
        let htmlNota = item.nota ? `<span class="nota-item">📌 ${item.nota}</span>` : '';
        let selectorMesaLlevar = `<select class="select-inline" onchange="cambiarTipoConsumoItem(${item.id}, this.value)"><option value="Mesa" ${item.tipoConsumo==='Mesa'?'selected':''}>🍽️ Mesa</option><option value="Llevar" ${item.tipoConsumo==='Llevar'?'selected':''}>🛍️ Llevar</option></select>`;
        lista.innerHTML += `<div class="ticket-row"><div class="row-main"><div class="info"><span class="nombre">${selectorMesaLlevar}${item.nombre}</span><span>${item.cantidad}x ${item.precio} Bs = ${subtotal} Bs</span>${htmlNota}</div><div class="controles"><button class="btn-ctrl red" onclick="quitarDelPedido(${item.id})">-</button><span>${item.cantidad}</span><button class="btn-ctrl" onclick="agregarAlPedido('${item.nombreBase}', '${item.nombre}', ${item.precio}, '${item.nota}', '${item.tipoConsumo}')">+</button></div></div></div>`;
    });
    document.getElementById('monto-total').innerText = totalActual + ' Bs.'; document.getElementById('btn-cobrar').disabled = totalActual === 0; calcularVuelto();
}

function togglePago() {
    let esEfectivo = document.getElementById('pago-efectivo').checked; let esQR = document.getElementById('pago-qr').checked; let esMixto = document.getElementById('pago-mixto').checked;
    document.getElementById('caja-vuelto').style.display = esEfectivo ? 'flex' : 'none'; document.getElementById('caja-qr').style.display = esQR ? 'block' : 'none'; document.getElementById('caja-mixto').style.display = esMixto ? 'flex' : 'none'; calcularVuelto();
}

function calcularVuelto() {
    let esEfectivo = document.getElementById('pago-efectivo').checked; let esMixto = document.getElementById('pago-mixto').checked;
    let cajaGestion = document.getElementById('caja-gestion-vuelto'); let totalVuelto = 0;
    if (esEfectivo) {
        let recibido = parseFloat(document.getElementById('monto-recibido').value) || 0; let txt = document.getElementById('monto-vuelto'); totalVuelto = recibido - totalActual;
        if (totalVuelto >= 0 && totalActual > 0) { txt.innerText = totalVuelto + ' Bs.'; txt.style.color = '#008000'; } else { txt.innerText = 'Falta dinero'; txt.style.color = '#ff0000'; }
    } else if (esMixto) {
        let ef = parseFloat(document.getElementById('monto-mixto-efectivo').value) || 0; let qr = parseFloat(document.getElementById('monto-mixto-qr').value) || 0;
        let txt = document.getElementById('monto-mixto-estado'); totalVuelto = (ef + qr) - totalActual;
        if (totalVuelto >= 0 && totalActual > 0) { txt.innerText = totalVuelto + ' Bs.'; txt.style.color = '#008000'; } else { txt.innerText = 'Falta: ' + Math.abs(totalVuelto) + ' Bs.'; txt.style.color = '#ff0000'; }
    }
    if (totalVuelto > 0 && totalActual > 0) { cajaGestion.style.display = 'block'; document.getElementById('vuelto-entregado').value = totalVuelto; calcularDeudaVuelto(); } else cajaGestion.style.display = 'none';
}

window.calcularDeudaVuelto = function() {
    let esEfectivo = document.getElementById('pago-efectivo').checked; let totalVuelto = 0;
    if (esEfectivo) totalVuelto = (parseFloat(document.getElementById('monto-recibido').value) || 0) - totalActual;
    else totalVuelto = ((parseFloat(document.getElementById('monto-mixto-efectivo').value) || 0) + (parseFloat(document.getElementById('monto-mixto-qr').value) || 0)) - totalActual;
    let deuda = totalVuelto - (parseFloat(document.getElementById('vuelto-entregado').value) || 0);
    if (deuda < 0) deuda = 0; document.getElementById('vuelto-deuda').innerText = deuda + ' Bs.';
}

function procesarPago() {
    let esEfectivo = document.getElementById('pago-efectivo').checked; let esQR = document.getElementById('pago-qr').checked; let esMixto = document.getElementById('pago-mixto').checked;
    let pagoEf = 0; let pagoQR = 0; let metodoTxt = ""; let nroFicha = estadoCaja.siguienteFicha || 1;
    let countMesa = pedidoActual.filter(i => i.tipoConsumo === 'Mesa').length; let countLlevar = pedidoActual.filter(i => i.tipoConsumo === 'Llevar').length;
    let tipoLugarAuto = (countMesa > 0 && countLlevar === 0) ? "Mesa" : (countLlevar > 0 && countMesa === 0) ? "Llevar" : "Mixto";
    let mesaInput = document.getElementById('input-mesa').value.trim(); let clienteInput = document.getElementById('input-cliente').value.trim();
    
    if (!clienteInput) clienteInput = "General";
    else if (!clientesDB.includes(clienteInput)) { clientesDB.push(clienteInput); localStorage.setItem('vicios_clientesDB', JSON.stringify(clientesDB)); cargarClientes(); }

    let montoRecibidoFisico = 0; let vueltoTotal = 0; let deudaVueltoFisico = 0;
    if (esEfectivo) {
        let recibido = parseFloat(document.getElementById('monto-recibido').value) || 0; if (recibido < totalActual) { alert("⚠️ Monto insuficiente en efectivo."); return; }
        pagoEf = totalActual; metodoTxt = "Efectivo"; montoRecibidoFisico = recibido; vueltoTotal = recibido - totalActual;
        deudaVueltoFisico = vueltoTotal - (parseFloat(document.getElementById('vuelto-entregado').value) || 0);
    } else if (esQR) { pagoQR = totalActual; metodoTxt = "QR"; } else if (esMixto) {
        let ef = parseFloat(document.getElementById('monto-mixto-efectivo').value) || 0; let qr = parseFloat(document.getElementById('monto-mixto-qr').value) || 0;
        if ((ef + qr) < totalActual) { alert("⚠️ La suma de Efectivo y QR no alcanza para el total."); return; }
        vueltoTotal = (ef + qr) - totalActual; pagoQR = qr; pagoEf = ef - vueltoTotal; if (pagoEf < 0) pagoEf = 0; 
        metodoTxt = `Mixto (Ef: ${pagoEf} / QR: ${pagoQR})`; montoRecibidoFisico = ef; 
        deudaVueltoFisico = vueltoTotal - (parseFloat(document.getElementById('vuelto-entregado').value) || 0);
    }
    if (deudaVueltoFisico < 0) deudaVueltoFisico = 0;

    let nuevaVenta = { 
        id: Date.now(), ficha: nroFicha, hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        tipoLugar: tipoLugarAuto, cliente: clienteInput, mesa: mesaInput, metodo: metodoTxt, 
        montoEfectivo: pagoEf, montoQR: pagoQR, total: totalActual, anulada: false, 
        montoRecibido: montoRecibidoFisico, vuelto: vueltoTotal, vueltoPendiente: deudaVueltoFisico,
        items: JSON.parse(JSON.stringify(pedidoActual))
    };

    ventasHoy.push(nuevaVenta); descontarStockPagado(nuevaVenta.items);
    estadoCaja.siguienteFicha = nroFicha + 1; actualizarTituloFicha();
    localStorage.setItem('vicios_estadoCaja', JSON.stringify(estadoCaja)); localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy));

    pedidoActual = []; document.getElementById('monto-recibido').value = ''; document.getElementById('monto-mixto-qr').value = ''; document.getElementById('monto-mixto-efectivo').value = '';
    document.getElementById('input-cliente').value = ''; document.getElementById('input-mesa').value = '';
    document.getElementById('vuelto-entregado').value = ''; document.getElementById('caja-gestion-vuelto').style.display = 'none';
    renderizarTicket();
    
    imprimirComanda(nuevaVenta);
}

// ==========================================
// MOTOR DE IMPRESIÓN GIGANTE PARA COCINA
// ==========================================
function imprimirComanda(v) {
    let divTicket = document.getElementById('ticket-termico');
    let itemsMesa = v.items.filter(i => i.tipoConsumo === 'Mesa');
    let itemsLlevar = v.items.filter(i => i.tipoConsumo === 'Llevar');

    // AÑADIDO: EL NOMBRE DEL CLIENTE AQUÍ
    let html = `
        <div class="ticket-titulo">VICIOS & SABORES</div>
        <div class="ticket-info">FECHA: ${new Date().toLocaleDateString()} | ${v.hora}</div>
        <div class="ticket-cliente">CLIENTE: ${v.cliente}</div>
        
        <div class="ticket-ficha">TICKET #${v.ficha}</div>
        
        ${v.mesa ? `<div class="ticket-mesa">MESA: ${v.mesa}</div>` : ''}
    `;

    if(itemsMesa.length > 0) {
        html += `<div class="ticket-seccion">🍽️ PARA MESA</div>`;
        itemsMesa.forEach(i => {
            html += `
            <div class="item-print">
                <div class="item-cant">${i.cantidad}X</div>
                <div class="item-detalle">
                    <span class="item-nombre">${i.nombre}</span>
                    ${i.nota ? `<span class="item-nota">📌 ${i.nota}</span>` : ''}
                </div>
            </div>`;
        });
    }

    if(itemsLlevar.length > 0) {
        html += `<div class="ticket-seccion">🛍️ PARA LLEVAR</div>`;
        itemsLlevar.forEach(i => {
            html += `
            <div class="item-print">
                <div class="item-cant">${i.cantidad}X</div>
                <div class="item-detalle">
                    <span class="item-nombre">${i.nombre}</span>
                    ${i.nota ? `<span class="item-nota">📌 ${i.nota}</span>` : ''}
                </div>
            </div>`;
        });
    }

    html += `
        <div class="divisor"></div>
        <br><br><br><br>
    `;

    divTicket.innerHTML = html;
    document.body.className = "modo-comanda";
    window.print();
    document.body.className = "";
}

function abrirCocina() {
    let lista = document.getElementById('lista-cocina'); lista.innerHTML = ''; let pendientesCount = 0;
    ventasHoy.forEach((v, indexVenta) => {
        if (v.anulada) return; let itemsPendientes = v.items.filter(i => !i.entregado); if (itemsPendientes.length === 0) return; 
        pendientesCount++; let mesaTxt = v.mesa ? ` | Mesa: ${v.mesa}` : '';
        let htmlItems = v.items.map((item, indexItem) => {
            let clase = item.entregado ? 'item-cocina entregado' : 'item-cocina'; let btn = item.entregado ? '✅ Listo' : `<button class="btn-check-item" onclick="marcarItemEntregado(${v.id}, ${indexItem})">Aceptar</button>`;
            return `<div class="${clase}"><span>${item.cantidad}x ${item.nombre} ${item.nota ? `<small style="color:#d35400;">(${item.nota})</small>`:''} [${item.tipoConsumo}]</span> ${btn}</div>`;
        }).join('');
        lista.innerHTML += `<div class="tarjeta-cocina"><h3>#${v.ficha} - ${v.cliente} ${mesaTxt} <span style="float:right; font-size:0.9rem;">${v.hora}</span></h3>${htmlItems}</div>`;
    });
    if (pendientesCount === 0) lista.innerHTML = '<h3 style="text-align:center; color:#2ecc71;">¡Todo al día en cocina! 🙌</h3>';
    document.getElementById('modal-cocina').style.display = 'flex';
}

window.marcarItemEntregado = function(ventaId, itemIndex) { let v = ventasHoy.find(x => x.id === ventaId); if(v && v.items[itemIndex]) { v.items[itemIndex].entregado = true; localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy)); abrirCocina(); } }

function generarReporteData(ventasData) {
    let ef = 0, qr = 0, conteo = {};
    ventasData.forEach(v => {
        if (!v.anulada) {
            if (v.montoEfectivo !== undefined) { ef += v.montoEfectivo; qr += v.montoQR; } else { if (v.metodo === 'Efectivo') ef += v.total; else qr += v.total; } 
            v.items.forEach(i => { conteo[i.nombreBase || i.nombre] = (conteo[i.nombreBase || i.nombre] || 0) + i.cantidad; });
        }
    });
    return { efectivo: ef, qr: qr, total: ef+qr, conteoPlatos: conteo };
}

function verHistorialHoy() { abrirCierreCaja(false, null, true); }

function abrirCierreCaja(esHistorico = false, historicoData = null, modoSoloVista = false) {
    let vRender = esHistorico ? historicoData.ventasArr : ventasHoy; let gRender = esHistorico ? (historicoData.gastosArr || []) : gastosHoy; let cChica = esHistorico ? historicoData.cajaChica : estadoCaja.cajaChica; let fTexto = esHistorico ? historicoData.fecha : new Date().toLocaleDateString();
    document.getElementById('fecha-reporte').innerText = `Fecha: ${fTexto}`; let btnAccionCierre = document.getElementById('btn-wa-cierre');
    
    if (modoSoloVista) { document.getElementById('titulo-modal-cierre').innerText = "📋 Historial de Ventas (Hoy)"; btnAccionCierre.style.display = 'none'; } 
    else if (esHistorico) { document.getElementById('titulo-modal-cierre').innerText = "📊 Reporte de Caja (Día Anterior)"; btnAccionCierre.style.display = 'block'; btnAccionCierre.innerText = "📩 Re-generar PDF y Enviar"; btnAccionCierre.onclick = reenviarWhatsAppHistorico; } 
    else { document.getElementById('titulo-modal-cierre').innerText = "🚨 CIERRE DE CAJA (FINAL DEL DÍA) 🚨"; btnAccionCierre.style.display = 'block'; btnAccionCierre.innerText = "📩 Cerrar Caja y PDF"; btnAccionCierre.onclick = enviarWhatsAppYGuardar; }

    let dataRep = generarReporteData(vRender); let totalGastos = 0; gRender.forEach(g => { totalGastos += g.monto; });

    const tbody = document.querySelector('#tabla-ventas-hoy tbody'); tbody.innerHTML = '';
    vRender.forEach(v => {
        let textoFicha = v.ficha ? ` - Ficha #${v.ficha}` : ''; let txtCliente = v.cliente ? `<strong style="color:#005580; font-size:1.1rem;">👤 ${v.cliente}</strong><br>` : ''; let infoMesa = v.mesa ? ` | MESA: ${v.mesa}` : ''; let etiquetaMesa = v.tipoLugar ? `<div style="background:#fff3e6; padding:4px 8px; border-radius:5px; color:#ff4500; border:1px solid #ff4500; display:inline-block; margin-bottom:5px; font-weight:bold; font-size:0.95rem;">[${v.tipoLugar.toUpperCase()}${infoMesa}${textoFicha}]</div><br>` : '';
        let txtVuelto = ""; let btnSaldar = "";
        if (v.vuelto > 0) { if (v.vueltoPendiente > 0) { txtVuelto = `<div class="alerta-deuda" style="color:red; font-weight:bold;">⚠️ FALTA VUELTO: Entregar ${v.vueltoPendiente} Bs<br><small>(Pagó con ${v.montoRecibido} Bs)</small></div>`; if (!esHistorico && !v.anulada) btnSaldar = `<button class="btn-saldar" style="background:#2ecc71; color:white; border:none; padding:5px; border-radius:3px; margin-top:5px; cursor:pointer;" onclick="saldarVuelto(${v.id})">✔️ Vuelto pagado</button>`; } else txtVuelto = `<br><span style="color:#25d366; font-size:0.85rem; font-weight:bold;">✅ Vuelto entregado: ${v.vuelto} Bs</span>`; }

        let txtItems = txtCliente + etiquetaMesa + v.items.map(i => { let tipoC = i.tipoConsumo ? ` <span style="color:#ff8c00; font-size:0.85rem; font-weight:bold;">[${i.tipoConsumo}]</span>` : ''; return `${i.cantidad}x ${i.nombre}${tipoC}${i.nota ? `<br><small style="color:#d35400;">(${i.nota})</small>`:''}` }).join('<br>') + txtVuelto;
        
        let btnAccion = (!esHistorico && !v.anulada) ? `<button class="btn-ctrl red" style="width:auto; padding:5px; font-size:0.8rem;" onclick="anularVenta(${v.id})" title="Anular">🗑️ Anular</button>` : (v.anulada ? 'Anulada' : 'Cerrada');
        let btnReimprimir = (!v.anulada) ? `<button class="btn-ctrl" style="background:#333; width:auto; padding:5px; font-size:0.8rem; margin-top:5px;" onclick='imprimirComanda(${JSON.stringify(v)})'>🖨️ Ticket</button>` : '';

        tbody.innerHTML = `<tr class="${v.anulada ? 'tr-anulada':''}"><td style="color:#000;">${v.hora}</td><td style="color:#000;">${txtItems}</td><td style="color:#000;">${v.metodo}</td><td style="color:#000; font-weight:bold;">${v.total} Bs</td><td class="col-accion" style="min-width: 120px; display:flex; flex-direction:column; gap:5px;">${btnAccion} ${btnReimprimir} ${btnSaldar}</td></tr>` + tbody.innerHTML; 
    });

    document.getElementById('resumen-caja-chica').innerText = cChica + ' Bs.'; document.getElementById('resumen-ventas-efectivo').innerText = dataRep.efectivo + ' Bs.'; document.getElementById('resumen-qr').innerText = dataRep.qr + ' Bs.'; document.getElementById('resumen-gastos-cierre').innerText = `- ${totalGastos} Bs.`; document.getElementById('resumen-cajon-final').innerText = ((dataRep.efectivo + cChica) - totalGastos) + ' Bs.';
    let htmlPlatos = Object.entries(dataRep.conteoPlatos).map(([nom, cant]) => `<strong>[${cant}]</strong> ${nom}`).join('<br>'); document.getElementById('resumen-platos').innerHTML = htmlPlatos || "No hay ventas registradas.";
    document.getElementById('modal-cierre').style.display = 'flex';
}

window.saldarVuelto = function(id) { if(confirm("✔️ ¿Confirmas que acabas de entregarle el dinero que faltaba?")) { let v = ventasHoy.find(x => x.id === id); if(v) v.vueltoPendiente = 0; localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy)); abrirCierreCaja(false, null, document.getElementById('titulo-modal-cierre').innerText.includes("Historial")); } }
function anularVenta(id) { if(confirm("🗑️ ¿Anular esta venta?\n\nEl dinero se descontará de la caja y el stock se devolverá.")) { let v = ventasHoy.find(x => x.id === id); if(v) { v.anulada = true; restaurarStockAnulado(v.items); } localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy)); abrirCierreCaja(false, null, document.getElementById('titulo-modal-cierre').innerText.includes("Historial")); } }

function enviarWhatsAppYGuardar() {
    if(!confirm("🚨 ¿CERRAR EL DÍA DE HOY?\n\nGenerará el PDF, enviará WhatsApp y pondrá la caja a 0.")) return;
    let dataRep = generarReporteData(ventasHoy); let totalGastos = 0; gastosHoy.forEach(g => { totalGastos += g.monto; }); let fecha = new Date().toLocaleDateString(); let resumenPlatosTexto = Object.entries(dataRep.conteoPlatos).map(([n, c]) => `${c}x ${n}`).join(', '); let deudaVueltos = 0; ventasHoy.forEach(v => { if(!v.anulada && v.vueltoPendiente > 0) deudaVueltos += v.vueltoPendiente; });

    historialDias.push({ fecha, cajaChica: estadoCaja.cajaChica, efectivo: dataRep.efectivo, qr: dataRep.qr, total: dataRep.efectivo+dataRep.qr, gastosArr: gastosHoy, ventasArr: JSON.parse(JSON.stringify(ventasHoy)), resumenPlatos: resumenPlatosTexto }); localStorage.setItem('vicios_historialDias', JSON.stringify(historialDias));
    alert("PASO 1: Dale a 'Guardar como PDF' en la ventana que aparecerá.\nPASO 2: Se abrirá WhatsApp, adjunta ahí el PDF.");
    
    document.body.className = "modo-cierre"; let tituloOriginal = document.title; let fechaFormateada = fecha.replace(/\//g, '_'); document.title = `REPORTE_DIA_${fechaFormateada}_V_&_S`;
    
    setTimeout(() => {
        window.print(); document.title = tituloOriginal; document.body.className = ""; 
        setTimeout(() => {
            let efCajon = (dataRep.efectivo + estadoCaja.cajaChica) - totalGastos; let txtDeuda = deudaVueltos > 0 ? `\n⚠️ *Vueltos pendientes:* ${deudaVueltos} Bs\n` : '';
            let textoWA = `📊 *CIERRE DE CAJA - VICIOS & SABORES* 🔥\n📅 Fecha: ${fecha}\n\n💵 *Caja Chica Inicial:* ${estadoCaja.cajaChica} Bs\n💰 *Ingresos Efectivo:* ${dataRep.efectivo} Bs\n🔴 *Gastos:* -${totalGastos} Bs\n👉 *EFECTIVO EN CAJÓN:* ${efCajon} Bs\n${txtDeuda}\n📱 *Ingresos QR:* ${dataRep.qr} Bs\n📈 *TOTAL VENTAS:* ${dataRep.efectivo + dataRep.qr} Bs\n\n🍗 *Platos:* ${resumenPlatosTexto || "Sin ventas"}\n\n📎 *(Te adjunto el PDF).*`;
            estadoCaja.abierta = false; estadoCaja.cajaChica = 0; estadoCaja.siguienteFicha = 1; ventasHoy = []; gastosHoy = []; inventarioDB = {};
            localStorage.setItem('vicios_estadoCaja', JSON.stringify(estadoCaja)); localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy)); localStorage.setItem('vicios_gastosHoy', JSON.stringify(gastosHoy)); localStorage.setItem('vicios_inventarioDB', JSON.stringify(inventarioDB));
            window.location.href = `https://wa.me/59179962454?text=${encodeURIComponent(textoWA)}`; 
        }, 3000);
    }, 100); 
}

function abrirHistorialDias() {
    const lista = document.getElementById('lista-dias'); lista.innerHTML = '';
    if (historialDias.length === 0) { lista.innerHTML = '<p style="text-align:center;">No hay días cerrados.</p>'; } else { historialDias.slice().reverse().forEach((dia, i) => { let id = historialDias.length - 1 - i; lista.innerHTML += `<div class="dia-card" onclick="verDetalleDia(${id})"><div class="dia-card-header"><span>🗓️ ${dia.fecha}</span><span>${dia.total} Bs.</span></div></div>`; }); }
    document.getElementById('modal-historial-dias').style.display = 'flex';
}
function verDetalleDia(index) { cerrarModales(); diaVisualizando = historialDias[index]; abrirCierreCaja(true, diaVisualizando); }
function reenviarWhatsAppHistorico() { alert("Para reenviar, imprime el PDF manualmente desde tu navegador en esta misma ventana de reporte."); }
