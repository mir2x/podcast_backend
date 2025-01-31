import express from "express";
import PodcastController from "@controllers/podcast";
import PodcastServices from "@services/podcast";
import { authorize } from "@middlewares/authorization";
import fileUpload from "express-fileupload";
import fileHandler from "@middlewares/fileHandler";

const router = express.Router();

router.get("/popular", authorize, PodcastServices.popularPodcasts);
router.get("/latest", authorize, PodcastServices.latestPodcasts);
router.get("/short", authorize, PodcastController.getShortPodcasts);

router.post("/create", fileUpload(), fileHandler, authorize, PodcastController.create);
router.get("/", authorize, PodcastController.getAll);
router.get("/:id", authorize, PodcastController.get);
router.put("/update/:id", fileUpload(), fileHandler, authorize, PodcastController.update);
router.delete("/delete/:id", authorize, PodcastController.remove);

router.post("/play/:id", authorize, PodcastServices.play);
router.post("/play-next/:id", authorize, PodcastServices.playNext);
router.post("/report", authorize, PodcastServices.reportPodcast);

export default router;
