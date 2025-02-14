"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = __importDefault(require("../controllers/auth"));
const express_1 = __importDefault(require("express"));
const authorization_1 = require("../middlewares/authorization");
const dashboard_1 = __importDefault(require("../controllers/dashboard"));
const router = express_1.default.Router();
router.post("/register", auth_1.default.register);
router.post("/activate", auth_1.default.activate);
router.post("/login", auth_1.default.login);
router.post("/forgot-password", auth_1.default.forgotPassword);
router.post("/verify-otp", auth_1.default.verifyOTP);
router.put("/reset-password", auth_1.default.resetPassword);
router.put("/change-password", authorization_1.authorize, authorization_1.isUserOrCreator, dashboard_1.default.changePassword);
router.delete("/delete", authorization_1.authorize, authorization_1.isUserOrCreator, auth_1.default.remove);
router.post("/refresh", authorization_1.refreshAuthorize, auth_1.default.getAccessToken);
exports.default = router;
