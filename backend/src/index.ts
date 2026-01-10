import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';
import { initializeBackendWallet, checkBackendWallet } from './services/movementBlockchain.js';

// Import routes
import streamsRouter from './routes/streams.js';
import claimRouter from './routes/claim.js';

config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check backend wallet status
    const walletStatus = await checkBackendWallet();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      blockchain: {
        wallet: walletStatus.initialized ? 'initialized' : 'not initialized',
        address: walletStatus.address,
        balance: walletStatus.balance,
      },
      contract: env.CONTRACT_ADDRESS,
      network: 'Movement Testnet',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Routes
app.use('/api/streams', streamsRouter);
app.use('/api/claim', claimRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Initialize and start server
async function start() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Connected to database');

    // Initialize backend wallet for on-chain transactions
    if (env.BACKEND_WALLET_PRIVATE_KEY) {
      try {
        initializeBackendWallet(env.BACKEND_WALLET_PRIVATE_KEY);
        const walletStatus = await checkBackendWallet();
        console.log(`✅ Backend wallet initialized: ${walletStatus.address}`);
        console.log(`   Balance: ${BigInt(walletStatus.balance) / BigInt(1e8)} MOVE`);
      } catch (walletError) {
        console.warn('⚠️ Failed to initialize backend wallet:', walletError);
        console.warn('   On-chain transactions will not work');
      }
    } else {
      console.warn('⚠️ BACKEND_WALLET_PRIVATE_KEY not set');
      console.warn('   On-chain transactions will not work');
      console.warn('   Set this in your .env file to enable blockchain transactions');
    }

    // Log contract info
    console.log(`📜 Contract: ${env.CONTRACT_ADDRESS}`);
    console.log(`🌐 Network: Movement Testnet`);

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Frontend URL: ${env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
