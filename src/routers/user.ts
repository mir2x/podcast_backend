import express from "express";
import UserController from "@controllers/user";
const router = express.Router();
import { authorize } from "@middlewares/authorization";

router.get("/", authorize, UserController.display);
router.put("/edit", authorize, UserController.update);
router.delete("/delete", UserController.remove);

export default router;
