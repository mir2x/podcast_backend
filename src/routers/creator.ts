import CreatorController from "@controllers/creator";
import express from "express";
import { authorize, isCreator } from "@middlewares/authorization";

const router = express.Router();

router.get("/all-podcasts", authorize, isCreator, CreatorController.getAllPodcasts);

export default router;
