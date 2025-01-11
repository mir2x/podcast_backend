"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const podcast_1 = __importDefault(require("../controllers/podcast"));
const podcast_2 = __importDefault(require("../services/podcast"));
const authorization_1 = require("../middlewares/authorization");
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const fileHandler_1 = __importDefault(require("../middlewares/fileHandler"));
const router = express_1.default.Router();
router.get("/popular", authorization_1.authorize, podcast_2.default.popularPodcasts);
router.get("/latest", authorization_1.authorize, podcast_2.default.latestPodcasts);
router.post("/create", (0, express_fileupload_1.default)(), fileHandler_1.default, authorization_1.authorize, podcast_1.default.create);
router.get("/", authorization_1.authorize, podcast_1.default.getAll);
router.get("/:id", authorization_1.authorize, podcast_1.default.get);
router.put("/update/:id", (0, express_fileupload_1.default)(), fileHandler_1.default, authorization_1.authorize, podcast_1.default.update);
router.delete("/delete/:id", authorization_1.authorize, podcast_1.default.remove);
router.post("/play/:id", authorization_1.authorize, podcast_2.default.play);
router.post("/play-next/:id", authorization_1.authorize, podcast_2.default.playNext);
router.post("/report", authorization_1.authorize, podcast_2.default.reportPodcast);
exports.default = router;
