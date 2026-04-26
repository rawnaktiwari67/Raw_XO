import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';

const PORT = parseInt(env.PORT, 10);

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 XO Universe API running on port ${PORT}`);
        console.log(`🌍 Environment: ${env.NODE_ENV}`);
    });
});
