import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";
import { uploadImage } from "../controllers/uploadController.js";

const router = express.Router();

router.post(
  "/image",
  authMiddleware,
  upload.single("image"),
  uploadImage
);

export default router;