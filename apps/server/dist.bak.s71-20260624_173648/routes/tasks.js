"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// v2.5.36: 加 authMiddleware — 之前 getProgress 无鉴权
router.use(auth_1.authMiddleware);
router.get('/:taskId/progress', taskController_1.taskController.getProgress);
exports.default = router;
