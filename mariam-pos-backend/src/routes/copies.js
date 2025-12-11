import express from 'express';
import multer from 'multer';
import os from 'os';
import { printCopies, getAvailablePrinters, uploadMiddleware, scanDocument, photocopy, createPdfFromImages, combineImages } from '../controllers/copiesController.js';

const router = express.Router();

// Ruta para imprimir copias
router.post('/print', uploadMiddleware, printCopies);
 
// Ruta para escanear documento
router.post('/scan', express.json(), scanDocument);
 
// Ruta para crear PDF desde múltiples imágenes
const uploadMultiple = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por archivo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido. Solo se permiten JPG y PNG.'));
    }
  }
}).array('images', 50); // Máximo 50 imágenes

router.post('/create-pdf', uploadMultiple, createPdfFromImages);
 
// Ruta para combinar dos imágenes en una sola
const uploadTwoImages = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por archivo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no válido. Solo se permiten JPG y PNG.'));
    }
  }
}).array('images', 2); // Exactamente 2 imágenes

router.post('/combine-images', uploadTwoImages, combineImages);
 
// Ruta para fotocopiar (escanear + imprimir)
router.post('/photocopy', express.json(), photocopy);
 
// Ruta para obtener impresoras disponibles
router.get('/printers', getAvailablePrinters);
 
export default router;

