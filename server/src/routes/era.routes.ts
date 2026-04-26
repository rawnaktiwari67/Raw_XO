import { Router } from 'express';
import Era from '../models/Era';
import { successResponse, errorResponse } from '../utils/apiResponse';

const router = Router();

// GET /eras — list all eras ordered
router.get('/', async (_req, res) => {
    try {
        const eras = await Era.find().sort({ order: 1 });
        res.json(successResponse(eras));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
});

// GET /eras/:slug
router.get('/:slug', async (req, res) => {
    try {
        const era = await Era.findOne({ slug: req.params.slug });
        if (!era) { res.status(404).json(errorResponse('Era not found')); return; }
        res.json(successResponse(era));
    } catch {
        res.status(500).json(errorResponse('Server error'));
    }
});

export default router;
