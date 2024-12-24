import express from "express";
import PodcastController from "@controllers/podcast";
import { authorize, isCreator } from "@middlewares/authorization";
import { handleFileUpload } from "@middlewares/uploadFile";
import { createPodcastValidator, ParamValidator } from "@middlewares/validation";

const router = express.Router();

router.post(
    "/create",
    authorize,
    isCreator,
    handleFileUpload,
    createPodcastValidator,
    PodcastController.create,
);
router.get("/popular", PodcastController.popularPodcasts);
router.get("/latest", PodcastController.latestPodcasts);
router.get("/", PodcastController.getAll);
router.get("/:id", ParamValidator, PodcastController.get);
router.put("/update/:id", authorize, ParamValidator, handleFileUpload, PodcastController.update);
router.delete("/delete/:id", ParamValidator, PodcastController.remove);
router.post("/play/:id", authorize, PodcastController.play);
router.post("/play-next/:id", authorize, PodcastController.playNext);
router.post("/report/:id", authorize, PodcastController.reportPodcast);

export default router;
