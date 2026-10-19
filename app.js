'use strict';
const moneda = new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'});
const consultas = [
  {id: 'procesadores', ruta: '/api/procesadores', categoria: 'procesador'},
  {id: 'graficas', ruta: '/api/tarjetas-graficas', categoria: 'tarjeta_grafica'}
];

function validarProductos(datos, categoria) {
  if (!Array.isArray(datos)) throw new Error('La API no devolvió una lista de productos.');
  for (const p of datos) {
    if (!p || p.categoria !== categoria || !Number.isInteger(p.id_producto) ||
        !['marca', 'modelo', 'descripcion'].every(campo => typeof p[campo] === 'string') ||
        typeof p.precio !== 'number' || !Number.isFinite(p.precio) || p.precio < 0 ||
        !Number.isInteger(p.stock) || p.stock < 0) {
      throw new Error('La API devolvió datos con formato o categoría incorrectos.');
    }
  }
  return datos;
}

for (const consulta of consultas) {
  const panel = document.getElementById(consulta.id);
  const boton = panel.querySelector('button');
  const estado = panel.querySelector('.status');
  const tabla = panel.querySelector('.table-wrap');
  const filas = panel.querySelector('tbody');
  const actualizado = panel.querySelector('.updated');
  const etiqueta = boton.textContent;

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    boton.textContent = 'Consultando…';
    panel.setAttribute('aria-busy', 'true');
    estado.className = 'status';
    estado.textContent = 'Recuperando productos. Espera un momento…';
    filas.replaceChildren();
    tabla.hidden = true;
    actualizado.textContent = '';
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 25000);
    try {
      // Siempre el mismo origen HTTPS de Vercel: nunca una IP de AWS aquí.
      const respuesta = await fetch(consulta.ruta, {cache: 'no-store', signal: controlador.signal});
      if (!respuesta.ok) {
        let mensaje = `No se pudo completar la consulta (HTTP ${respuesta.status}).`;
        if ((respuesta.headers.get('content-type') || '').includes('application/json')) {
          const error = await respuesta.json();
          if (typeof error.detail === 'string') mensaje += ` ${error.detail}`;
        }
        throw new Error(mensaje);
      }
      const productos = validarProductos(await respuesta.json(), consulta.categoria);
      const fragmento = document.createDocumentFragment();
      for (const producto of productos) {
        const fila = document.createElement('tr');
        const valores = [producto.id_producto, producto.marca, producto.modelo,
          producto.descripcion, moneda.format(producto.precio), producto.stock];
        for (const valor of valores) {
          const celda = document.createElement('td');
          celda.textContent = String(valor); // Los datos se muestran como texto, no HTML.
          fila.appendChild(celda);
        }
        fragmento.appendChild(fila);
      }
      filas.appendChild(fragmento);
      tabla.hidden = productos.length === 0;
      estado.className = 'status success';
      estado.textContent = productos.length
        ? `${productos.length} productos recuperados correctamente.`
        : 'Consulta completada. No hay productos registrados en esta categoría.';
      actualizado.textContent = `Última consulta: ${new Date().toLocaleString('es-MX')}`;
    } catch (error) {
      estado.className = 'status error';
      estado.textContent = error.name === 'AbortError'
        ? 'La consulta tardó demasiado. Verifica que la API siga disponible y vuelve a intentarlo.'
        : error instanceof SyntaxError
          ? 'La respuesta no es JSON válido. Revisa la ruta configurada en Vercel.'
          : error instanceof TypeError
            ? 'No se pudo contactar con el servicio. Revisa tu conexión y vuelve a intentarlo.'
            : error.message;
    } finally {
      clearTimeout(limite);
      boton.disabled = false;
      boton.textContent = etiqueta;
      panel.setAttribute('aria-busy', 'false');
    }
  });
}
