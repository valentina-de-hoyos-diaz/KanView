const mongoose = require('mongoose');
const { Schema } = mongoose;

const actividadSchema = new Schema(
  {
    descripcion: { type: String, required: true },
    estado: { type: [String], required: true },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    idTarea: { type: Schema.Types.ObjectId, ref: 'TareaPedido', required: true },
    nombre: { type: String, required: true },
  },
  { collection: 'actividades' }
);

module.exports = mongoose.model('Actividad', actividadSchema);