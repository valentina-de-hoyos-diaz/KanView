const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditoriaSchema = new Schema(
  {
    usuario: { type: Schema.Types.ObjectId, refPath: 'tipoUsuario', default: null },
    tipoUsuario: {
      type: String,
      enum: ['Usuario', 'Cliente', 'Sistema'],
      default: 'Sistema',
    },
    accion: { type: String, required: true, trim: true, maxlength: 80 },
    entidad: { type: String, default: '', trim: true, maxlength: 80 },
    entidadId: { type: String, default: '', trim: true, maxlength: 80 },
    detalle: { type: String, default: '', trim: true, maxlength: 2000 },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 500 },
  },
  { collection: 'auditoria', timestamps: true }
);

auditoriaSchema.index({ createdAt: -1 });
auditoriaSchema.index({ accion: 1, createdAt: -1 });
auditoriaSchema.index({ entidad: 1, entidadId: 1, createdAt: -1 });
auditoriaSchema.index({ usuario: 1, createdAt: -1 });
auditoriaSchema.index({ entidad: 1, createdAt: -1 });

module.exports = mongoose.model('Auditoria', auditoriaSchema);
