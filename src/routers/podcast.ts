import express from "express";
import PodcastController from "@controllers/podcast";
import { authorize, isCreator } from "@middlewares/authorization";
import { handleFileUpload } from "@middlewares/uploadFile";
import { createPodcastValidator, ParamValidator } from "@middlewares/validation";

const router = express.Router();

router.post("/create", authorize, isCreator, handleFileUpload, createPodcastValidator, PodcastController.create);
router.get("/", PodcastController.getAll);
router.get("/:id", ParamValidator, PodcastController.get);
router.put("/update/:id", authorize, ParamValidator, handleFileUpload, PodcastController.update);
router.delete("/delete/:id", ParamValidator, PodcastController.remove);

// router.post(
//   "/comment/:id",
//   authorize(),
//   isActive() || isCreator(),
//   PodcastController.commentPodcast
// );
// router.post(
//   "/favorite/:id",
//   authorize(),
//   isActive(),
//   PodcastController.favoritePodcast
// );

// router.get("/play/:id", PodcastController.playPodcast);

export default router;
