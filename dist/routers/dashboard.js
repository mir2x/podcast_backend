"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dashboard_1 = __importDefault(require("../controllers/dashboard"));
const admin_1 = __importDefault(require("../services/admin"));
const authorization_1 = require("../middlewares/authorization");
const router = express_1.default.Router();
router.get("/all-users", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.displayAllUsers);
router.get("/all-creators", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.displayAllCreators);
router.get("/admin", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.adminProfile);
router.post("/login", dashboard_1.default.login);
router.put("/update", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.updateProfile);
router.put("/change-password", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.changePassword);
router.post("/block/:id", authorization_1.authorize, authorization_1.isAdmin, admin_1.default.block);
router.post("/unblock/:id", authorization_1.authorize, authorization_1.isAdmin, admin_1.default.unblock);
router.post("/approve/:id", authorization_1.authorize, authorization_1.isAdmin, admin_1.default.approve);
router.get("/income", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.incomeByMonth);
router.get("/total-subscriber", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.totalSubscriber);
router.get("/subscriber", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.subscribersByMonth);
router.get("/search-creators", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.searchCreatorsByName);
router.get("/search-users", authorization_1.authorize, authorization_1.isAdmin, dashboard_1.default.searchUsersByName);
exports.default = router;
