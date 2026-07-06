"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 公开接口
router.post('/register', userController_1.userController.register);
router.post('/login', userController_1.userController.login);
// 需要登录的接口
router.get('/profile', auth_1.authMiddleware, userController_1.userController.getProfile);
router.put('/profile', auth_1.authMiddleware, userController_1.userController.updateProfile);
router.put('/password', auth_1.authMiddleware, userController_1.userController.changePassword);
router.get('/pricing', auth_1.authMiddleware, userController_1.userController.getPricing);
router.get('/billing', auth_1.authMiddleware, userController_1.userController.getBillingLogs);
router.post('/vip/buy', auth_1.authMiddleware, userController_1.userController.buyVip);
router.get('/usage', auth_1.authMiddleware, userController_1.userController.getUsage);
router.get('/history', auth_1.authMiddleware, userController_1.userController.getHistory);
exports.default = router;
