import SubCategoryController from "@controllers/subCategory";
import express from "express";
import { authorize, isAdmin } from "@middlewares/authorization";
import { handleFileUpload } from "@middlewares/uploadFile";

const router = express.Router();

router.post("/create", authorize, isAdmin, handleFileUpload, SubCategoryController.create);
router.get("/", authorize, SubCategoryController.getAll);
router.get("/:id", authorize, SubCategoryController.get);
router.put("/update/:id", authorize, isAdmin, handleFileUpload, SubCategoryController.update);
router.delete("/delete/:id", authorize, isAdmin, SubCategoryController.remove);
router.get("/:id/podcasts", authorize, SubCategoryController.getPodcasts);

export default router;
