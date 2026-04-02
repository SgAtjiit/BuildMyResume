import multer from "multer";
import path from "path"
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.resolve(process.cwd(), "./public/temp");
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  
  }
})

export const upload = multer({ storage })