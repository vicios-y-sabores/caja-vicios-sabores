// --- SISTEMA DE LOGIN Y ROLES ---
let usuarioActual = JSON.parse(sessionStorage.getItem('vicios_usuarioActivo'));

if (!usuarioActual) {
    window.location.href = 'index.html'; // Patea al login si no está autenticado
}

function cerrarSesion() {
    if(confirm("¿Seguro que deseas cerrar sesión?")) {
        sessionStorage.removeItem('vicios_usuarioActivo');
        window.location.href = 'index.html';
    }
}

// --- BASE DE DATOS LOCAL ---
let estadoCaja = JSON.parse(localStorage.getItem('vicios_estadoCaja')) || { abierta: false, cajaChica: 0 };
let ventasHoy = JSON.parse(localStorage.getItem('vicios_ventasHoy')) || [];
let gastosHoy = JSON.parse(localStorage.getItem('vicios_gastosHoy')) || [];
let historialDias = JSON.parse(localStorage.getItem('vicios_historialDias')) || [];
let pedidoActual = []; 
let totalActual = 0;

let cfgActual = null;
let nombreItemBase = "";
let precioBase = 0;
let diaVisualizando = null; // Para reenviar reportes pasados

// Estructura de Modales inyectada
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
            <p style="margin-top: 15px; font-weight: bold; color: #333;">Nota especial (Opcional):</p>
            <input type="text" id="modal-dinamico-nota" class="input-grande" placeholder="Ej: Bien dorado, sin llajua...">
            <button class="btn-accion" onclick="confirmarItemDinamico()">✔️ Agregar al Pedido</button>
            <button class="btn-accion btn-cancelar" onclick="cerrarModales()">❌ Cancelar</button>
        </div>
    </div>

    <div class="modal-overlay" id="modal-qr-flotante" onclick="cerrarQRFlotante()">
        <div class="modal" style="max-width: 450px; text-align: center; background: #fff;">
            <h2 style="color:#25d366; border-bottom:none; margin-bottom:5px;">📱 Escanea para Pagar</h2>
            <img src="img/qr.jpg" alt="QR" style="width: 100%; max-width: 350px; border: 4px solid #25d366; border-radius: 15px;" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg'">
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

    <div class="modal-overlay" id="modal-cierre">
        <div class="modal" style="max-width: 800px; width: 95%; max-height: 95vh; padding: 20px; display: flex; flex-direction: column;">
            <div id="area-impresion" style="flex: 1; overflow-y: auto; padding-right: 10px;">
                <h2 id="titulo-modal-cierre">📊 Reporte de Caja</h2>
                <h3 id="fecha-reporte" style="text-align:center; color:#555; margin-bottom:10px;"></h3>
                
                <div class="caja-info"><span>Caja Chica Inicial:</span> <span id="resumen-caja-chica">0 Bs.</span></div>
                <div class="caja-info" style="background: #e6f7ff;"><span>Ingresos Efectivo (Ventas):</span> <span id="resumen-ventas-efectivo" style="color:#005580;">0 Bs.</span></div>
                <div class="caja-info" style="background: #e6ffe6;"><span>Ingresos QR (Banco):</span> <span id="resumen-qr" style="color:#008000;">0 Bs.</span></div>
                <div class="caja-info" style="background: #ffe6e6; color:#dc3545;"><span>Gastos del Día:</span> <span id="resumen-gastos-cierre">- 0 Bs.</span></div>
                
                <div class="caja-info resaltado">
                    <span>EFECTIVO FINAL EN CAJÓN:</span> 
                    <span id="resumen-cajon-final" style="color:#ff4500; font-size:1.3rem;">0 Bs.</span>
                </div>

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
    // Aplicar restricciones de ROL
    if (usuarioActual.rol === "cajero") {
        document.querySelector('.btn-gastos').style.display = 'none';
        document.querySelector('button[onclick="abrirHistorialDias()"]').style.display = 'none';
        document.querySelector('.caja-chica-display').onclick = null;
        document.querySelector('.caja-chica-display').style.cursor = 'default';
        document.querySelector('.caja-chica-display').title = 'Modificación solo para Administradores';
    }

    // --- RECUPERACIÓN DEL DÍA 24/02/2026 ---
    let existe24 = historialDias.find(d => d.fecha === "24/02/2026");
    if (!existe24) {
        historialDias.push({
            fecha: "24/02/2026",
            cajaChica: 0,
            efectivo: 194,
            qr: 162,
            total: 356,
            resumenPlatos: "3x Económico ⅛ (Pecho), 10x Silpancho de Res, 2x Jarra 2 ½ Litros (Limón), 2x Jarra 1 ½ Litros (Maracuyá), 1x Alitas 8 Pz, 5x Económico ⅛ (Pierna)",
            gastosArr: [],
            ventasArr: [
                { id: 201, hora: "09:59 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 34, montoQR: 0, total: 34, anulada: false, items: [{cantidad: 2, nombre: "Económico ⅛ (Pecho)", precio: 17}] },
                { id: 202, hora: "09:42 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 15, montoQR: 0, total: 15, anulada: false, items: [{cantidad: 1, nombre: "Económico ⅛ (Pierna)", precio: 15}] },
                { id: 203, hora: "09:30 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 30, montoQR: 0, total: 30, anulada: false, items: [{cantidad: 1, nombre: "Económico ⅛ (Pierna)", precio: 15}, {cantidad: 1, nombre: "Silpancho de Res", precio: 15}] },
                { id: 204, hora: "08:55 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 15, montoQR: 0, total: 15, anulada: false, items: [{cantidad: 1, nombre: "Silpancho de Res", precio: 15}] },
                { id: 205, hora: "08:52 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 30, montoQR: 0, total: 30, anulada: false, items: [{cantidad: 2, nombre: "Económico ⅛ (Pierna)", precio: 15}] },
                { id: 206, hora: "08:50 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 70, montoQR: 0, total: 70, anulada: false, items: [{cantidad: 1, nombre: "Alitas 8 Pz", precio: 30}, {cantidad: 1, nombre: "Económico ⅛ (Pierna)", precio: 15}, {cantidad: 1, nombre: "Silpancho de Res", precio: 15}, {cantidad: 1, nombre: "Jarra 1 ½ Litros (Maracuyá)", precio: 10}] },
                { id: 207, hora: "08:34 p. m.", tipoLugar: "Mesa", metodo: "QR", montoEfectivo: 0, montoQR: 55, total: 55, anulada: false, items: [{cantidad: 3, nombre: "Silpancho de Res", precio: 15}, {cantidad: 1, nombre: "Jarra 1 ½ Litros (Maracuyá)", precio: 10}] },
                { id: 208, hora: "08:20 p. m.", tipoLugar: "Mesa", metodo: "QR", montoEfectivo: 0, montoQR: 107, total: 107, anulada: false, items: [{cantidad: 1, nombre: "Económico ⅛ (Pecho)", precio: 17}, {cantidad: 4, nombre: "Silpancho de Res", precio: 15}, {cantidad: 2, nombre: "Jarra 2 ½ Litros (Limón)", precio: 15}] }
            ]
        });
        localStorage.setItem('vicios_historialDias', JSON.stringify(historialDias));
    }

    // --- RECUPERACIÓN DEL DÍA 25/02/2026 ---
    let existe25 = historialDias.find(d => d.fecha === "25/02/2026");
    if (!existe25) {
        historialDias.push({
            fecha: "25/02/2026", 
            cajaChica: 51, 
            efectivo: 611, 
            qr: 35, 
            total: 646,
            resumenPlatos: "7x Alitas 4 Pz, 2x Alitas 6 Pz, 1x Alitas 8 Pz, 12x Silpancho de Res, 1x Silpancho con 2 Huevos, 4x Milanesa, 2x Económico ⅛ (Pierna), 1x Económico ⅛ (Pecho), 1x Económico ⅛ (Entre Pierna), 1x Económico ⅛ (Ala), 1x Cuarto de Pollo (Pecho y Ala), 6x Jarra 1 ½ Litros (Maracuyá), 3x Vaso (Maracuyá), 3x Vaso (Limón)",
            gastosArr: [ { id: 1, detalle: "Gastos registrados del día", monto: 25 } ], 
            ventasArr: [
                { id: 101, hora: "11:01 p. m.", tipoLugar: "Llevar", metodo: "Efectivo", montoEfectivo: 45, montoQR: 0, total: 45, anulada: false, items: [{cantidad: 2, nombre: "Silpancho de Res", precio: 15}, {cantidad: 1, nombre: "Milanesa", precio: 15}] },
                { id: 102, hora: "10:52 p. m.", tipoLugar: "Mesa", metodo: "Mixto (Ef: 28 / QR: 25)", montoEfectivo: 28, montoQR: 25, total: 53, anulada: false, items: [{cantidad: 2, nombre: "Alitas 6 Pz", precio: 25}, {cantidad: 1, nombre: "Vaso (Maracuyá)", precio: 3}] },
                { id: 103, hora: "10:42 p. m.", tipoLugar: "Llevar", metodo: "Efectivo", montoEfectivo: 15, montoQR: 0, total: 15, anulada: false, items: [{cantidad: 1, nombre: "Silpancho de Res", precio: 15}] },
                { id: 104, hora: "10:41 p. m.", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 40, montoQR: 0, total: 40, anulada: false, items: [{cantidad: 1, nombre: "Milanesa", precio: 15}, {cantidad: 1, nombre: "Económico ⅛ (Pierna)", precio: 15}, {cantidad: 1, nombre: "Jarra 1 ½ Litros (Maracuyá)", precio: 10}] },
                { id: 105, hora: "10:06 p. m.", tipoLugar: "Mesa", metodo: "QR", montoEfectivo: 0, montoQR: 10, total: 10, anulada: false, items: [{cantidad: 1, nombre: "Jarra 1 ½ Litros (Maracuyá)", precio: 10}] },
                { id: 106, hora: "Resumen", tipoLugar: "Mesa", metodo: "Efectivo", montoEfectivo: 483, montoQR: 0, total: 483, anulada: false, items: [{cantidad: 7, nombre: "Alitas 4 Pz", precio: 18}, {cantidad: 1, nombre: "Alitas 8 Pz", precio: 30}, {cantidad: 9, nombre: "Silpancho de Res", precio: 15}, {cantidad: 1, nombre: "Silpancho con 2 Huevos", precio: 17}, {cantidad: 2, nombre: "Milanesa", precio: 15}, {cantidad: 1, nombre: "Económico ⅛ (Pierna)", precio: 15}, {cantidad: 1, nombre: "Económico ⅛ (Pecho)", precio: 17}, {cantidad: 1, nombre: "Económico ⅛ (Entre Pierna)", precio: 15}, {cantidad: 1, nombre: "Económico ⅛ (Ala)", precio: 17}, {cantidad: 1, nombre: "Cuarto de Pollo (Pecho y Ala)", precio: 26}, {cantidad: 4, nombre: "Jarra 1 ½ Litros (Maracuyá)", precio: 10}, {cantidad: 2, nombre: "Vaso (Maracuyá)", precio: 3}, {cantidad: 3, nombre: "Vaso (Limón)", precio: 3}] }
            ]
        });
        localStorage.setItem('vicios_historialDias', JSON.stringify(historialDias));
    }

    // --- ORDENAR EL HISTORIAL POR FECHA ---
    historialDias.sort((a, b) => {
        let partsA = a.fecha.split('/');
        let partsB = b.fecha.split('/');
        let dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
        let dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
        return dateA - dateB;
    });

    if (!estadoCaja.abierta) {
        document.getElementById('modal-apertura').style.display = 'flex';
    } else {
        actualizarHeaderCaja();
    }
};

function actualizarHeaderCaja() {
    document.getElementById('lbl-caja-chica-header').innerText = `Caja Chica: ${estadoCaja.cajaChica} Bs`;
}

function abrirCaja() {
    let monto = parseFloat(document.getElementById('input-caja-chica').value) || 0;
    estadoCaja = { abierta: true, cajaChica: monto };
    ventasHoy = []; gastosHoy = [];
    localStorage.setItem('vicios_estadoCaja', JSON.stringify(estadoCaja));
    localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy));
    localStorage.setItem('vicios_gastosHoy', JSON.stringify(gastosHoy));
    actualizarHeaderCaja();
    cerrarModales();
}

function modificarCajaChica() {
    let pass = prompt("Para modificar la Caja Chica, ingresa la contraseña maestra:");
    if (pass === "Terceros_V&S") {
        let nuevoMonto = prompt("Ingresa el nuevo monto exacto de la Caja Chica en Bs:", estadoCaja.cajaChica);
        if (nuevoMonto !== null && !isNaN(nuevoMonto)) {
            estadoCaja.cajaChica = parseFloat(nuevoMonto);
            localStorage.setItem('vicios_estadoCaja', JSON.stringify(estadoCaja));
            actualizarHeaderCaja();
            alert("Caja Chica actualizada con éxito.");
        }
    } else if (pass !== null) {
        alert("❌ Contraseña incorrecta.");
    }
}

// Gastos
function abrirGastos() { renderizarGastos(); document.getElementById('modal-gastos').style.display = 'flex'; }
function agregarGasto() {
    let detalle = document.getElementById('input-gasto-detalle').value.trim();
    let monto = parseFloat(document.getElementById('input-gasto-monto').value);
    if(!detalle || isNaN(monto) || monto <= 0) { alert("Por favor ingresa un detalle y monto válido."); return; }
    gastosHoy.push({ id: Date.now(), detalle, monto });
    localStorage.setItem('vicios_gastosHoy', JSON.stringify(gastosHoy));
    document.getElementById('input-gasto-detalle').value = ""; document.getElementById('input-gasto-monto').value = "";
    renderizarGastos();
}
function eliminarGasto(id) { gastosHoy = gastosHoy.filter(g => g.id !== id); localStorage.setItem('vicios_gastosHoy', JSON.stringify(gastosHoy)); renderizarGastos(); }
function renderizarGastos() {
    const lista = document.getElementById('lista-gastos'); let total = 0; lista.innerHTML = '';
    gastosHoy.forEach(g => {
        total += g.monto;
        lista.innerHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px dashed #ccc;"><span style="color:#000;">${g.detalle}</span><div style="display:flex; gap:10px;"><strong style="color:#dc3545;">${g.monto} Bs</strong><button style="background:none; border:none; color:red; cursor:pointer;" onclick="eliminarGasto(${g.id})">❌</button></div></div>`;
    });
    document.getElementById('total-gastos-display').innerText = total;
}

// Modales de Productos
function abrirModalDinamico(nombre, precioBaseParam, config) {
    cfgActual = config; nombreItemBase = nombre; precioBase = precioBaseParam;
    document.getElementById('modal-dinamico-titulo').innerText = nombre;
    document.getElementById('modal-dinamico-nota').value = "";
    let contenidoHTML = "";

    if (config.tipo === 'alitas') {
        if (config.piezas === 4) {
            contenidoHTML += `<p style="font-weight:bold; margin-bottom:5px; color:#333;">Elige 1 Salsa obligatoria:</p><select class="form-select" id="alita-salsa-1"><option value="BBQ">Salsa BBQ</option><option value="Miel Mostaza">Salsa Miel Mostaza</option><option value="Picante">Salsa Picante</option></select>`;
        } else {
            let mitad = config.piezas / 2;
            contenidoHTML += `<p style="font-weight:bold; margin-bottom:10px; color:#ff0000; font-size:1.1rem;">⚠️ Debes distribuir exactamente ${config.piezas} alitas:</p>
                <div class="fila-alitas"><input type="number" id="alita-qty-1" class="input-grande" value="${mitad}" min="0" max="${config.piezas}"><span style="color:#000; font-weight:bold;">Alitas de:</span><select class="form-select" id="alita-salsa-1"><option value="BBQ">BBQ</option><option value="Miel Mostaza" selected>Miel Mostaza</option><option value="Picante">Picante</option></select></div>
                <div class="fila-alitas"><input type="number" id="alita-qty-2" class="input-grande" value="${mitad}" min="0" max="${config.piezas}"><span style="color:#000; font-weight:bold;">Alitas de:</span><select class="form-select" id="alita-salsa-2"><option value="Picante">Picante</option><option value="BBQ" selected>BBQ</option><option value="Miel Mostaza">Miel Mostaza</option></select></div>`;
        }
    } 
    else if (config.tipo === 'presa') {
        contenidoHTML += `<p style="font-weight:bold; margin-bottom:5px; color:#333;">Elige la presa exacta:</p><select class="form-select" id="cmb-presa">${config.opciones.map(op => `<option value="${op}">${op}</option>`).join('')}</select>`;
    }
    else if (config.tipo === 'refresco') {
        contenidoHTML += `<p style="font-weight:bold; margin-bottom:5px; color:#333;">Elige el sabor:</p><select class="form-select" id="cmb-refresco"><option value="Maracuyá">Maracuyá</option><option value="Limón">Limón</option><option value="Canela">Canela</option></select>`;
    }
    document.getElementById('modal-dinamico-contenido').innerHTML = contenidoHTML;
    document.getElementById('modal-dinamico').style.display = 'flex';
}

function confirmarItemDinamico() {
    let detalle = ""; let nombreFinal = nombreItemBase;

    if (cfgActual.tipo === 'alitas') {
        if (cfgActual.piezas === 4) {
            let s1 = document.getElementById('alita-salsa-1').value; detalle = `1 Salsa: ${s1}`;
        } else {
            let q1 = parseInt(document.getElementById('alita-qty-1').value) || 0; let s1 = document.getElementById('alita-salsa-1').value;
            let q2 = parseInt(document.getElementById('alita-qty-2').value) || 0; let s2 = document.getElementById('alita-salsa-2').value;

            if (q1 + q2 !== cfgActual.piezas) { alert(`❌ ERROR EN LAS CANTIDADES:\n\nEl plato debe sumar exactamente ${cfgActual.piezas} alitas.`); return; }
            if (s1 === s2) { detalle = `Salsa: ${s1} (Todas)`; } else {
                let partes = []; if(q1 > 0) partes.push(`${q1} de ${s1}`); if(q2 > 0) partes.push(`${q2} de ${s2}`); detalle = partes.join(' y ');
            }
        }
    } 
    else if (cfgActual.tipo === 'presa') { nombreFinal = `${nombreItemBase.split(' (')[0]} (${document.getElementById('cmb-presa').value})`; } 
    else if (cfgActual.tipo === 'refresco') { nombreFinal += ` (${document.getElementById('cmb-refresco').value})`; }

    let notaInput = document.getElementById('modal-dinamico-nota').value.trim();
    if (notaInput) detalle += (detalle ? " | " : "") + notaInput;

    agregarAlPedido(nombreFinal, precioBase, detalle);
    cerrarModales();
}

function cerrarModales() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
function abrirQRFlotante() { if(totalActual>0){document.getElementById('qr-total-flotante').innerText=totalActual+' Bs.';document.getElementById('modal-qr-flotante').style.display='flex';}else{alert("Agrega productos al ticket primero.");}}
function cerrarQRFlotante() { document.getElementById('modal-qr-flotante').style.display = 'none'; }

// Carrito
function agregarAlPedido(nombre, precio, nota) {
    let index = pedidoActual.findIndex(i => i.nombre === nombre && i.nota === nota);
    if (index > -1) pedidoActual[index].cantidad++; else pedidoActual.push({ nombre, precio, nota, cantidad: 1, id: Date.now() + Math.random() });
    renderizarTicket();
}
function quitarDelPedido(id) {
    let index = pedidoActual.findIndex(i => i.id === id);
    if (index > -1) { pedidoActual[index].cantidad--; if (pedidoActual[index].cantidad <= 0) pedidoActual.splice(index, 1); }
    renderizarTicket();
}
function vaciarTicket() { if (pedidoActual.length > 0 && confirm("🗑️ ¿Vaciar todo el ticket?")) { pedidoActual = []; renderizarTicket(); } }

function renderizarTicket() {
    const lista = document.getElementById('lista-ticket');
    lista.innerHTML = ''; totalActual = 0;
    pedidoActual.forEach(item => {
        let subtotal = item.cantidad * item.precio; totalActual += subtotal;
        let htmlNota = item.nota ? `<span class="nota-item">📌 ${item.nota}</span>` : '';
        lista.innerHTML += `<div class="ticket-row"><div class="row-main"><div class="info"><span class="nombre">${item.nombre}</span><span>${item.cantidad}x ${item.precio} Bs = ${subtotal} Bs</span>${htmlNota}</div><div class="controles"><button class="btn-ctrl red" onclick="quitarDelPedido(${item.id})">-</button><span>${item.cantidad}</span><button class="btn-ctrl" onclick="agregarAlPedido('${item.nombre}', ${item.precio}, '${item.nota}')">+</button></div></div></div>`;
    });
    document.getElementById('monto-total').innerText = totalActual + ' Bs.';
    document.getElementById('btn-cobrar').disabled = totalActual === 0;
    calcularVuelto();
}

// LOGICA DE PAGO Y PAGO MIXTO
function togglePago() {
    let esEfectivo = document.getElementById('pago-efectivo').checked;
    let esQR = document.getElementById('pago-qr').checked;
    let esMixto = document.getElementById('pago-mixto').checked;

    document.getElementById('caja-vuelto').style.display = esEfectivo ? 'flex' : 'none';
    document.getElementById('caja-qr').style.display = esQR ? 'block' : 'none';
    document.getElementById('caja-mixto').style.display = esMixto ? 'flex' : 'none';
    calcularVuelto();
}

function calcularVuelto() {
    let esEfectivo = document.getElementById('pago-efectivo').checked;
    let esMixto = document.getElementById('pago-mixto').checked;

    if (esEfectivo) {
        let recibido = parseFloat(document.getElementById('monto-recibido').value) || 0;
        let txt = document.getElementById('monto-vuelto');
        if ((recibido - totalActual) >= 0 && totalActual > 0) { txt.innerText = (recibido - totalActual) + ' Bs.'; txt.style.color = '#008000'; } 
        else { txt.innerText = 'Falta dinero'; txt.style.color = '#ff0000'; }
    } else if (esMixto) {
        let ef = parseFloat(document.getElementById('monto-mixto-efectivo').value) || 0;
        let qr = parseFloat(document.getElementById('monto-mixto-qr').value) || 0;
        let suma = ef + qr;
        let txt = document.getElementById('monto-mixto-estado');
        if (suma >= totalActual && totalActual > 0) {
            txt.innerText = 'Vuelto (Ef): ' + (suma - totalActual) + ' Bs.'; txt.style.color = '#008000';
        } else {
            txt.innerText = 'Falta: ' + (totalActual - suma) + ' Bs.'; txt.style.color = '#ff0000';
        }
    }
}

function procesarPago() {
    let tipoLugar = document.getElementById('tipo-pedido').value;
    let esEfectivo = document.getElementById('pago-efectivo').checked;
    let esQR = document.getElementById('pago-qr').checked;
    let esMixto = document.getElementById('pago-mixto').checked;
    
    let pagoEf = 0; let pagoQR = 0; let metodoTxt = "";

    if (esEfectivo) {
        let recibido = parseFloat(document.getElementById('monto-recibido').value) || 0;
        if (recibido < totalActual) { alert("⚠️ Monto insuficiente en efectivo."); return; }
        pagoEf = totalActual; metodoTxt = "Efectivo";
    } else if (esQR) {
        pagoQR = totalActual; metodoTxt = "QR";
    } else if (esMixto) {
        let ef = parseFloat(document.getElementById('monto-mixto-efectivo').value) || 0;
        let qr = parseFloat(document.getElementById('monto-mixto-qr').value) || 0;
        if ((ef + qr) < totalActual) { alert("⚠️ La suma de Efectivo y QR no alcanza para el total."); return; }
        
        let vuelto = (ef + qr) - totalActual;
        pagoQR = qr; // El QR entra íntegro al banco
        pagoEf = ef - vuelto; // El vuelto se da en efectivo real
        if (pagoEf < 0) pagoEf = 0; 
        metodoTxt = `Mixto (Ef: ${pagoEf} / QR: ${pagoQR})`;
    }

    if (!confirm(`✅ ¿Registrar venta por ${totalActual} Bs?\n\nPedido: ${tipoLugar}`)) return;

    ventasHoy.push({ 
        id: Date.now(), hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
        tipoLugar: tipoLugar, metodo: metodoTxt, 
        montoEfectivo: pagoEf, montoQR: pagoQR, total: totalActual, anulada: false, 
        items: JSON.parse(JSON.stringify(pedidoActual)) 
    });
    localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy));

    pedidoActual = []; document.getElementById('monto-recibido').value = ''; 
    document.getElementById('monto-mixto-qr').value = ''; document.getElementById('monto-mixto-efectivo').value = '';
    renderizarTicket();
    
    const btn = document.getElementById('btn-cobrar'); btn.innerText = "¡COBRADO EXITO! ✅"; btn.style.background = "#25d366";
    setTimeout(() => { btn.innerText = "🛒 COBRAR PEDIDO"; btn.style.background = "#ff4500"; }, 1500);
}

// Reportes
function generarReporteData(ventasData) {
    let ef = 0, qr = 0, conteo = {};
    ventasData.forEach(v => {
        if (!v.anulada) {
            if (v.montoEfectivo !== undefined) { ef += v.montoEfectivo; qr += v.montoQR; } 
            else { if (v.metodo === 'Efectivo') ef += v.total; else qr += v.total; } // Soporte a ventas viejas
            v.items.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad; });
        }
    });
    return { efectivo: ef, qr: qr, total: ef+qr, conteoPlatos: conteo };
}

function verHistorialHoy() { abrirCierreCaja(false, null, true); }

function abrirCierreCaja(esHistorico = false, historicoData = null, modoSoloVista = false) {
    let vRender = esHistorico ? historicoData.ventasArr : ventasHoy;
    let gRender = esHistorico ? (historicoData.gastosArr || []) : gastosHoy;
    let cChica = esHistorico ? historicoData.cajaChica : estadoCaja.cajaChica;
    let fTexto = esHistorico ? historicoData.fecha : new Date().toLocaleDateString();

    document.getElementById('fecha-reporte').innerText = `Fecha: ${fTexto}`;
    let btnAccionCierre = document.getElementById('btn-wa-cierre');
    
    if (modoSoloVista) {
        document.getElementById('titulo-modal-cierre').innerText = "📋 Historial de Ventas (Hoy)";
        btnAccionCierre.style.display = 'none';
    } else if (esHistorico) {
        document.getElementById('titulo-modal-cierre').innerText = "📊 Reporte de Caja (Día Anterior)";
        btnAccionCierre.style.display = 'block';
        btnAccionCierre.innerText = "📩 Re-generar PDF y Enviar";
        btnAccionCierre.onclick = reenviarWhatsAppHistorico;
    } else {
        document.getElementById('titulo-modal-cierre').innerText = "🚨 CIERRE DE CAJA (FINAL DEL DÍA) 🚨";
        btnAccionCierre.style.display = 'block';
        btnAccionCierre.innerText = "📩 Cerrar Caja y PDF";
        btnAccionCierre.onclick = enviarWhatsAppYGuardar;
    }

    let dataRep = generarReporteData(vRender);
    let totalGastos = 0; gRender.forEach(g => { totalGastos += g.monto; });

    const tbody = document.querySelector('#tabla-ventas-hoy tbody'); tbody.innerHTML = '';
    vRender.forEach(v => {
        let etiquetaMesa = v.tipoLugar ? `<strong>[${v.tipoLugar.toUpperCase()}]</strong><br>` : '';
        let txtItems = etiquetaMesa + v.items.map(i => `${i.cantidad}x ${i.nombre}${i.nota ? `<br><small style="color:#d35400;">(${i.nota})</small>`:''}`).join('<br>');
        let btnAccion = (!esHistorico && !v.anulada) ? `<button class="btn-ctrl red" onclick="anularVenta(${v.id})" title="Anular">🗑️</button>` : (v.anulada ? 'Anulada' : 'Cerrada');
        tbody.innerHTML = `<tr class="${v.anulada ? 'tr-anulada':''}"><td style="color:#000;">${v.hora}</td><td style="color:#000;">${txtItems}</td><td style="color:#000;">${v.metodo}</td><td style="color:#000; font-weight:bold;">${v.total} Bs</td><td class="col-accion">${btnAccion}</td></tr>` + tbody.innerHTML; 
    });

    document.getElementById('resumen-caja-chica').innerText = cChica + ' Bs.';
    document.getElementById('resumen-ventas-efectivo').innerText = dataRep.efectivo + ' Bs.';
    document.getElementById('resumen-qr').innerText = dataRep.qr + ' Bs.';
    document.getElementById('resumen-gastos-cierre').innerText = `- ${totalGastos} Bs.`;
    document.getElementById('resumen-cajon-final').innerText = ((dataRep.efectivo + cChica) - totalGastos) + ' Bs.';

    let htmlPlatos = Object.entries(dataRep.conteoPlatos).map(([nom, cant]) => `<strong>[${cant}]</strong> ${nom}`).join('<br>');
    document.getElementById('resumen-platos').innerHTML = htmlPlatos || "No hay ventas registradas.";

    document.getElementById('modal-cierre').style.display = 'flex';
}

function anularVenta(id) {
    if(confirm("🗑️ ¿Anular esta venta?\n\nEl dinero se descontará de la caja.")) {
        let v = ventasHoy.find(x => x.id === id); if(v) v.anulada = true;
        localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy));
        abrirCierreCaja(false, null, document.getElementById('titulo-modal-cierre').innerText.includes("Historial")); 
    }
}

// ==========================================
// CIERRE Y GENERACION DE PDF
// ==========================================
function enviarWhatsAppYGuardar() {
    if(!confirm("🚨 ¡ATENCIÓN! 🚨\n\n¿CERRAR EL DÍA DE HOY?\n\nGenerará el PDF, enviará WhatsApp y pondrá la caja a 0.")) return;

    let dataRep = generarReporteData(ventasHoy);
    let totalGastos = 0; gastosHoy.forEach(g => { totalGastos += g.monto; });
    let fecha = new Date().toLocaleDateString();
    let resumenPlatosTexto = Object.entries(dataRep.conteoPlatos).map(([n, c]) => `${c}x ${n}`).join(', ');

    historialDias.push({ fecha, cajaChica: estadoCaja.cajaChica, efectivo: dataRep.efectivo, qr: dataRep.qr, total: dataRep.efectivo+dataRep.qr, gastosArr: gastosHoy, ventasArr: JSON.parse(JSON.stringify(ventasHoy)), resumenPlatos: resumenPlatosTexto });
    localStorage.setItem('vicios_historialDias', JSON.stringify(historialDias));

    alert("PASO 1: Dale a 'Guardar como PDF' en la ventana que aparecerá.\nPASO 2: Se abrirá WhatsApp, adjunta ahí el PDF guardado.");
    
    document.querySelector('.modal-botones').style.display = 'none';
    document.getElementById('area-impresion').style.overflowY = 'visible';
    
    // 🔥 TRUCO MAGICO: Forzar el nombre del PDF
    let tituloOriginal = document.title;
    let fechaFormateada = fecha.replace(/\//g, '_'); 
    document.title = `REPORTE_DIA_${fechaFormateada}_V_&_S`;
    
    // Pausa de 0.1s para que Chrome alcance a leer el título antes de imprimir
    setTimeout(() => {
        window.print();

        // Restaurar pantalla
        document.title = tituloOriginal;
        document.querySelector('.modal-botones').style.display = 'flex';
        document.getElementById('area-impresion').style.overflowY = 'auto';

        // Lanzar WhatsApp a los 3 segundos
        setTimeout(() => {
            let efCajon = (dataRep.efectivo + estadoCaja.cajaChica) - totalGastos;
            let textoWA = `📊 *CIERRE DE CAJA - VICIOS & SABORES* 🔥\n📅 Fecha: ${fecha}\n\n💵 *Caja Chica Inicial:* ${estadoCaja.cajaChica} Bs\n💰 *Ingresos Efectivo:* ${dataRep.efectivo} Bs\n🔴 *Gastos:* -${totalGastos} Bs\n👉 *EFECTIVO EN CAJÓN:* ${efCajon} Bs\n\n📱 *Ingresos QR:* ${dataRep.qr} Bs\n📈 *TOTAL VENTAS:* ${dataRep.efectivo + dataRep.qr} Bs\n\n🍗 *Platos:* ${resumenPlatosTexto || "Sin ventas"}\n\n📎 *(Te adjunto el PDF del reporte a este mensaje).*`;

            let url = `https://wa.me/59179962454?text=${encodeURIComponent(textoWA)}`;
            
            estadoCaja.abierta = false; estadoCaja.cajaChica = 0; ventasHoy = []; gastosHoy = [];
            localStorage.setItem('vicios_estadoCaja', JSON.stringify(estadoCaja)); localStorage.setItem('vicios_ventasHoy', JSON.stringify(ventasHoy)); localStorage.setItem('vicios_gastosHoy', JSON.stringify(gastosHoy));
            
            window.open(url, '_blank'); window.location.reload(); 
        }, 3000);
    }, 100); 
}

function abrirHistorialDias() {
    const lista = document.getElementById('lista-dias'); lista.innerHTML = '';
    if (historialDias.length === 0) { lista.innerHTML = '<p style="text-align:center;">No hay días cerrados.</p>'; } 
    else {
        historialDias.slice().reverse().forEach((dia, i) => {
            let id = historialDias.length - 1 - i;
            lista.innerHTML += `<div class="dia-card" onclick="verDetalleDia(${id})"><div class="dia-card-header"><span>🗓️ ${dia.fecha}</span><span>${dia.total} Bs.</span></div><p style="color:#555; font-size:0.9rem;">Clic para ver detalle</p></div>`;
        });
    }
    document.getElementById('modal-historial-dias').style.display = 'flex';
}

function verDetalleDia(index) { 
    cerrarModales(); 
    diaVisualizando = historialDias[index]; 
    abrirCierreCaja(true, diaVisualizando); 
}

function reenviarWhatsAppHistorico() {
    if(!diaVisualizando) return;
    
    alert("PASO 1: Dale a 'Guardar como PDF' en la ventana que aparecerá.\nPASO 2: Se abrirá WhatsApp para reenviar el reporte.");
    
    document.querySelector('.modal-botones').style.display = 'none';
    document.getElementById('area-impresion').style.overflowY = 'visible';
    
    // 🔥 TRUCO MAGICO PARA DÍAS PASADOS
    let tituloOriginal = document.title;
    let fechaFormateada = diaVisualizando.fecha.replace(/\//g, '_'); 
    document.title = `REPORTE_DIA_${fechaFormateada}_V_&_S`;

    setTimeout(() => {
        window.print();

        // Restaurar pantalla
        document.title = tituloOriginal;
        document.querySelector('.modal-botones').style.display = 'flex';
        document.getElementById('area-impresion').style.overflowY = 'auto';

        setTimeout(() => {
            let totalGastos = 0;
            if(diaVisualizando.gastosArr) {
                diaVisualizando.gastosArr.forEach(g => totalGastos += g.monto);
            }
            
            let efCajon = (diaVisualizando.efectivo + diaVisualizando.cajaChica) - totalGastos;
            let textoWA = `📊 *REPORTE REENVIADO - VICIOS & SABORES* 🔥\n📅 Fecha: ${diaVisualizando.fecha}\n\n💵 *Caja Chica Inicial:* ${diaVisualizando.cajaChica} Bs\n💰 *Ingresos Efectivo:* ${diaVisualizando.efectivo} Bs\n🔴 *Gastos:* -${totalGastos} Bs\n👉 *EFECTIVO EN CAJÓN:* ${efCajon} Bs\n\n📱 *Ingresos QR:* ${diaVisualizando.qr} Bs\n📈 *TOTAL VENTAS:* ${diaVisualizando.efectivo + diaVisualizando.qr} Bs\n\n🍗 *Platos:*\n${diaVisualizando.resumenPlatos || "Sin ventas"}\n\n📎 *(Te adjunto el PDF del reporte a este mensaje).*`;

            let url = `https://wa.me/59179962454?text=${encodeURIComponent(textoWA)}`;
            window.open(url, '_blank'); 
        }, 3000);
    }, 100);
}
