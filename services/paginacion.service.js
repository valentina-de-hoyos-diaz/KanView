const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

const enteroPositivo = (valor, porDefecto) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
};

const obtenerPaginacion = (query = {}) => {
  const pagina = enteroPositivo(query.pagina, 1);
  const limite = Math.min(enteroPositivo(query.limite, LIMITE_POR_DEFECTO), LIMITE_MAXIMO);
  return {
    pagina,
    limite,
    skip: (pagina - 1) * limite,
  };
};

const metadatos = (total, { pagina, limite }) => ({
  pagina,
  limite,
  total,
  paginas: Math.ceil(total / limite),
  tieneSiguiente: pagina * limite < total,
  tieneAnterior: pagina > 1,
});

const aplicarPopulate = (consulta, populate) => {
  if (!populate) return consulta;
  const lista = Array.isArray(populate) ? populate : [populate];
  return lista.reduce((actual, opcion) => actual.populate(opcion), consulta);
};

const consultarPaginado = async (
  modelo,
  filtro = {},
  { query = {}, sort = {}, populate = null, select = null } = {}
) => {
  const paginacion = obtenerPaginacion(query);
  let consulta = modelo
    .find(filtro)
    .sort(sort)
    .skip(paginacion.skip)
    .limit(paginacion.limite);

  if (select) consulta = consulta.select(select);
  consulta = aplicarPopulate(consulta, populate);

  const [items, total] = await Promise.all([consulta, modelo.countDocuments(filtro)]);

  return {
    items,
    total,
    paginacion: metadatos(total, paginacion),
  };
};

const responderPaginado = (res, message, items, paginacion) =>
  res.status(200).json({
    status: 200,
    message,
    data: items,
    paginacion,
  });

module.exports = {
  LIMITE_POR_DEFECTO,
  LIMITE_MAXIMO,
  obtenerPaginacion,
  metadatos,
  consultarPaginado,
  responderPaginado,
};
