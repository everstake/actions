import { Connection, clusterApiUrl} from '@solana/web3.js';
require('dotenv').config();

export const connection = new Connection(process.env.RPC_URL || clusterApiUrl('mainnet-beta'));