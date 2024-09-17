import { Router } from 'express';
import { renderProducersPage } from '../controllers/viewController';

const router = Router();

router.get('/', renderProducersPage);

export default router;