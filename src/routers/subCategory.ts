import SubCategoryController from "@controllers/subCategory";
import express from "express";
import { authorize, isAdmin } from "@middlewares/authorization";
import { handleFileUpload } from "@middlewares/uploadFile";
import fileUpload from "express-fileupload";
import fileHandler from "@middlewares/fileHandler";

const router = express.Router();

router.post("/create", fileUpload(), fileHandler, authorize, isAdmin, SubCategoryController.create);
router.get("/", authorize, SubCategoryController.getAll);
router.get("/:id", authorize, SubCategoryController.get);
router.put(
  "/update/:id",
  fileUpload(),
  fileHandler,
  authorize,
  isAdmin,
  SubCategoryController.update,
);
router.delete("/delete/:id", authorize, isAdmin, SubCategoryController.remove);
router.get("/:id/podcasts", authorize, SubCategoryController.getPodcasts);

export default router;
