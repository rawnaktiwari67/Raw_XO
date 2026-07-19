import { env } from './config/env';
import { validateEnv } from './config/env';
import { connectDB } from './config/db';
import { initErrorReporting } from './utils/errorReporting';
import app from './app';

const PORT = parseInt(env.PORT, 10);

validateEnv();
initErrorReporting();

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Raw XO API running on port ${PORT}`);
        console.log(`🌍 Environment: ${env.NODE_ENV}`);
    });
});
