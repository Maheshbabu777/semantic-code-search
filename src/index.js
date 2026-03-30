import express from 'express';
import cors from 'cors';
import searchRoute from './routes/search.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/search', searchRoute);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Server is running on port http://localhost:${PORT}/`));