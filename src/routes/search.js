import { Router } from 'express';
import { kmpSearch } from '../search/kmp.js';


const router = Router();

router.post('/', (req, res) => {
    const { text, pattern, algorithm = 'kmp' } = req.body;

    if (!text || !pattern) {
        return res.status(400).json({ error: "Text and pattern are required" });
    }
    const matches = kmpSearch(text, pattern);

    res.json({
        algorithm,
        pattern,
        matchCount: matches.length,
        matches
    });
});

export default router;