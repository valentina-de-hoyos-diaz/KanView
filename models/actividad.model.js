const mongoose = require('mongoose');
const { Schema } = mongoose;

const { ESTADOS_TRABAJO } = require('./tareaPedido.model');

const actividadSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    descripcion: { type: String, required: true, trim: true, maxlength: 1000 },
    estado: { type: String, enum: ESTADOS_TRABAJO, default: 'Pendiente' },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    idTarea: { type: Schema.Types.ObjectId, ref: 'TareaPedido', required: true, index: true },
    empleadoId: { type: Schema.Types.ObjectId, ref: 'Trabajador', default: null },
    activo: { type: Boolean, default: true, index: true },
  },
  { collection: 'actividades', timestamps: true }
);

actividadSchema.index({ idTarea: 1, activo: 1, createdAt: -1 });
actividadSchema.index({ idTarea: 1, estado: 1, activo: 1 });
actividadSchema.index({ empleadoId: 1, estado: 1, activo: 1 });
actividadSchema.index({ empleadoId: 1, estado: 1, fechaInicio: 1 });

module.exports = mongoose.model('Actividad', actividadSchema);
