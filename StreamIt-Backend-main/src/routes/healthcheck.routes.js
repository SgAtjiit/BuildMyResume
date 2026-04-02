import { Router } from 'express';
import { healthcheck } from "../contollers/healthcheck.controller.js"

const router = Router();

router.route('/').get(healthcheck);

export default router