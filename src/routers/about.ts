import express from "express";
import AboutController from "@controllers/about";
import { authorize, isAdmin } from "@middlewares/authorization";

const router = express.Router();

router.post("/add", AboutController.add);
router.get("/", authorize, isAdmin, AboutController.get);
router.put("/update/:id", authorize, isAdmin, AboutController.update);

export default router;
