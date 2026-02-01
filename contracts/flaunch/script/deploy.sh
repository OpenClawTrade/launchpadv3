#!/bin/bash

# Tuna Flaunch Deployment Script for Base
# Usage: ./deploy.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}

echo "🐟 Tuna Flaunch Deployment Script"
echo "================================="
echo "Network: $NETWORK"

# Check required environment variables
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "❌ Error: DEPLOYER_PRIVATE_KEY not set"
    exit 1
fi

if [ -z "$BASESCAN_API_KEY" ]; then
    echo "⚠️  Warning: BASESCAN_API_KEY not set, verification will be skipped"
fi

# Install dependencies if not present
if [ ! -d "lib/forge-std" ]; then
    echo "📦 Installing dependencies..."
    forge install foundry-rs/forge-std --no-commit
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
    forge install Uniswap/v4-core --no-commit
    forge install Uniswap/v4-periphery --no-commit
    forge install aave/aave-v3-core --no-commit
fi

# Compile contracts
echo "🔨 Compiling contracts..."
forge build

# Set RPC URL based on network
if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL=${BASE_RPC_URL:-"https://mainnet.base.org"}
    CHAIN_ID=8453
    echo "⚠️  Deploying to MAINNET - Are you sure? (Ctrl+C to cancel)"
    sleep 5
else
    RPC_URL=${BASE_SEPOLIA_RPC_URL:-"https://sepolia.base.org"}
    CHAIN_ID=84532
fi

echo "📡 RPC URL: $RPC_URL"
echo "🔗 Chain ID: $CHAIN_ID"

# Deploy
echo "🚀 Deploying contracts..."
if [ -n "$BASESCAN_API_KEY" ]; then
    forge script script/Deploy.s.sol \
        --rpc-url $RPC_URL \
        --broadcast \
        --verify \
        --etherscan-api-key $BASESCAN_API_KEY \
        -vvv
else
    forge script script/Deploy.s.sol \
        --rpc-url $RPC_URL \
        --broadcast \
        -vvv
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Copy the deployed addresses from the output above"
echo "2. Update src/lib/baseContracts.ts with the new addresses"
echo "3. Test the flaunch function on the frontend"
echo ""
