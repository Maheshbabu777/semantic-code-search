import { Router } from 'express';
import { boyerMoore } from '../search/boyerMoore.js';
import { kmpSearch } from '../search/kmp.js';
import { indexsToLocations } from '../search/utils.js';


const router = Router();

router.post('/', (req, res) => {
    const { text, pattern, algorithm = 'kmp' } = req.body;

    if (!text || !pattern) {
        return res.status(400).json({ error: "Text and pattern are required" });
    }
    const rawmatches = algorithm === 'bm' ? boyerMoore(text, pattern) : kmpSearch(text, pattern);

    const matches = indexsToLocations(text, rawmatches);

    res.json({
        algorithm,
        pattern,
        matchCount: matches.length,
        matches
    });
});

export default router;