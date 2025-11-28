import express from 'express';
import { printCopies, getAvailablePrinters, uploadMiddleware, scanDocument, photocopy } from '../controllers/copiesController.js';

const router = express.Router();

// Ruta para imprimir copias
router.post('/print', uploadMiddleware, printCopies);
console.log('✅ Ruta POST /copies/print registrada');

// Ruta para escanear documento
router.post('/scan', express.json(), scanDocument);
console.log('✅ Ruta POST /copies/scan registrada');

// Ruta para fotocopiar (escanear + imprimir)
router.post('/photocopy', express.json(), photocopy);
console.log('✅ Ruta POST /copies/photocopy registrada');

// Ruta para obtener impresoras disponibles
router.get('/printers', getAvailablePrinters);
console.log('✅ Ruta GET /copies/printers registrada');

export default router;

