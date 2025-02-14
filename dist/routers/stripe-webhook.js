"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_webhook_1 = __importDefault(require("../controllers/stripe-webhook"));
const body_parser_1 = __importDefault(require("body-parser"));
const router = express_1.default.Router();
router.post("/webhook", body_parser_1.default.raw({ type: "application/json" }), stripe_webhook_1.default.webhook);
exports.default = router;
