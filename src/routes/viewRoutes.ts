import { Router } from 'express';
import { renderProducersPage } from '../controllers/viewController';

const router = Router();

router.get('/producers', renderProducersPage);

export default router;