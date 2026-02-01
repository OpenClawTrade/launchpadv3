// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {TunaFlETH} from "../TunaFlETH.sol";
import {TunaFlaunch} from "../TunaFlaunch.sol";
import {TunaBidWall} from "../TunaBidWall.sol";
import {TunaFairLaunch} from "../TunaFairLaunch.sol";
import {TunaPositionManager} from "../TunaPositionManager.sol";
import {TunaMemecoin} from "../TunaMemecoin.sol";

/**
 * @title Deploy
 * @notice Deployment script for Tuna Flaunch contracts on Base
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast --verify
 */
contract DeployScript is Script {
    // Base Sepolia addresses
    address constant AAVE_POOL_SEPOLIA = address(0); // TODO: Add when available
    address constant WETH_SEPOLIA = 0x4200000000000000000000000000000000000006;
    
    // Base Mainnet addresses
    address constant AAVE_POOL_MAINNET = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address constant WETH_MAINNET = 0x4200000000000000000000000000000000000006;
    
    // Uniswap V4 PoolManager (Base)
    address constant POOL_MANAGER_BASE = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;
    
    // Deployed contract addresses (filled after deployment)
    TunaFlETH public flETH;
    TunaFlaunch public flaunch;
    TunaBidWall public bidWall;
    TunaFairLaunch public fairLaunch;
    TunaPositionManager public positionManager;
    TunaMemecoin public memecoinImpl;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Determine if testnet or mainnet based on chain ID
        bool isTestnet = block.chainid == 84532; // Base Sepolia
        address aavePool = isTestnet ? AAVE_POOL_SEPOLIA : AAVE_POOL_MAINNET;
        address weth = isTestnet ? WETH_SEPOLIA : WETH_MAINNET;
        
        console.log("Chain ID:", block.chainid);
        console.log("Is Testnet:", isTestnet);
        
        // Step 1: Deploy TunaFlETH (yield wrapper)
        console.log("\n=== Step 1: Deploying TunaFlETH ===");
        flETH = new TunaFlETH(aavePool);
        console.log("TunaFlETH deployed at:", address(flETH));
        
        // Step 2: Deploy Memecoin implementation (for cloning)
        console.log("\n=== Step 2: Deploying Memecoin Implementation ===");
        memecoinImpl = new TunaMemecoin("Implementation", "IMPL", "", address(0));
        console.log("Memecoin implementation deployed at:", address(memecoinImpl));
        
        // Step 3: Deploy TunaFlaunch (NFT contract)
        console.log("\n=== Step 3: Deploying TunaFlaunch ===");
        string memory baseURI = isTestnet 
            ? "https://api.tuna.fun/metadata/testnet/" 
            : "https://api.tuna.fun/metadata/";
        flaunch = new TunaFlaunch(baseURI);
        console.log("TunaFlaunch deployed at:", address(flaunch));
        
        // Step 4: Deploy TunaPositionManager (V4 Hook)
        console.log("\n=== Step 4: Deploying TunaPositionManager ===");
        positionManager = new TunaPositionManager(
            IPoolManager(POOL_MANAGER_BASE),
            address(flETH),
            deployer // protocol fee recipient
        );
        console.log("TunaPositionManager deployed at:", address(positionManager));
        
        // Step 5: Deploy TunaBidWall
        console.log("\n=== Step 5: Deploying TunaBidWall ===");
        bidWall = new TunaBidWall(
            IPoolManager(POOL_MANAGER_BASE),
            address(positionManager),
            address(flETH)
        );
        console.log("TunaBidWall deployed at:", address(bidWall));
        
        // Step 6: Deploy TunaFairLaunch
        console.log("\n=== Step 6: Deploying TunaFairLaunch ===");
        fairLaunch = new TunaFairLaunch(
            address(positionManager),
            address(flETH)
        );
        console.log("TunaFairLaunch deployed at:", address(fairLaunch));
        
        // Step 7: Initialize cross-references
        console.log("\n=== Step 7: Initializing Cross-References ===");
        
        // Initialize PositionManager with other contracts
        positionManager.initialize(
            ITunaFlaunch(address(flaunch)),
            bidWall,
            fairLaunch
        );
        console.log("PositionManager initialized");
        
        // Initialize Flaunch with PositionManager
        flaunch.initialize(
            IPositionManager(address(positionManager)),
            address(memecoinImpl),
            address(0) // Treasury implementation - TODO
        );
        console.log("Flaunch initialized");
        
        // Initialize BidWall
        bidWall.initialize();
        console.log("BidWall initialized");
        
        // Initialize FairLaunch
        fairLaunch.initialize();
        console.log("FairLaunch initialized");
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("TunaFlETH:           ", address(flETH));
        console.log("TunaFlaunch:         ", address(flaunch));
        console.log("TunaBidWall:         ", address(bidWall));
        console.log("TunaFairLaunch:      ", address(fairLaunch));
        console.log("TunaPositionManager: ", address(positionManager));
        console.log("Memecoin Impl:       ", address(memecoinImpl));
        console.log("========================================");
        
        // Generate update command for baseContracts.ts
        console.log("\nUpdate src/lib/baseContracts.ts with:");
        console.log("TUNA_POSITION_MANAGER:", address(positionManager));
        console.log("TUNA_FLAUNCH:", address(flaunch));
        console.log("TUNA_FLETH:", address(flETH));
        console.log("TUNA_BID_WALL:", address(bidWall));
        console.log("TUNA_FAIR_LAUNCH:", address(fairLaunch));
    }
}

// Minimal interfaces for deployment
interface IPoolManager {}
interface ITunaFlaunch {}
interface IPositionManager {}
