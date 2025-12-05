import { createPublicClient, http, encodeFunctionData, decodeFunctionResult, formatUnits, PublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { DAI_ADDRESS, ERC20_ABI, MULTICALL_ADDRESS, MULTICALL_ABI } from '../constants';
import { getRpcUrl } from './storageService';

// Initialize Viem Client dynamically
let client: PublicClient;

export const reinitializeClient = () => {
  const rpcUrl = getRpcUrl();
  console.log(`Initializing Web3 Client with RPC: ${rpcUrl}`);
  client = createPublicClient({
    chain: polygon,
    transport: http(rpcUrl)
  });
};

// Initial load
reinitializeClient();

export const fetchBlockNumber = async (): Promise<number> => {
  try {
    const blockNumber = await client.getBlockNumber();
    return Number(blockNumber);
  } catch (error) {
    console.error("Error fetching block number:", error);
    return 0;
  }
};

export const fetchBalancesBatch = async (addresses: string[]): Promise<Map<string, number>> => {
  if (addresses.length === 0) return new Map();

  // Create Multicall calls
  const calls = addresses.map(addr => ({
    target: DAI_ADDRESS,
    allowFailure: true,
    callData: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [addr as `0x${string}`],
    })
  }));

  try {
    // Execute Multicall
    // Note: In production with 200+ addresses, you might want to chunk this into batches of 50-100
    // to avoid RPC limits, but Multicall3 handles large batches relatively well.
    const CHUNK_SIZE = 100;
    const resultsMap = new Map<string, number>();

    for (let i = 0; i < calls.length; i += CHUNK_SIZE) {
      const chunkCalls = calls.slice(i, i + CHUNK_SIZE);
      
      const results = await client.readContract({
        address: MULTICALL_ADDRESS,
        abi: MULTICALL_ABI,
        functionName: 'aggregate3',
        args: [chunkCalls]
      });

      chunkCalls.forEach((_, index) => {
        const result = results[index];
        const address = addresses[i + index];

        if (result.success) {
          const balanceBigInt = decodeFunctionResult({
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            data: result.returnData,
          });
          // DAI has 18 decimals
          const formatted = parseFloat(formatUnits(balanceBigInt, 18));
          resultsMap.set(address, formatted);
        } else {
          resultsMap.set(address, 0); // Default to 0 on failure
        }
      });
    }

    return resultsMap;

  } catch (error) {
    console.error("Multicall failed:", error);
    throw error;
  }
};