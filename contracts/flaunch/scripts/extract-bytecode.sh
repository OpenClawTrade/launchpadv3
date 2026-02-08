#!/bin/bash

# Extract bytecode from compiled Foundry artifacts
# Run this after 'forge build' to get bytecode for edge function deployment

set -e

echo "🔨 Building contracts..."
forge build

echo ""
echo "📦 Extracting bytecode..."
echo ""

OUT_DIR="out"
CONTRACTS=("TunaFlETH" "TunaMemecoin" "TunaFlaunch" "TunaPositionManager" "TunaBidWall" "TunaFairLaunch")

echo "// Copy this to supabase/functions/base-deploy-contracts/index.ts"
echo "// Replace the empty bytecode strings in CONTRACT_ARTIFACTS"
echo ""

for CONTRACT in "${CONTRACTS[@]}"; do
  # Find the JSON file
  JSON_FILE=$(find $OUT_DIR -name "${CONTRACT}.json" -path "*/${CONTRACT}.sol/*" | head -1)
  
  if [ -z "$JSON_FILE" ]; then
    echo "// ⚠️  ${CONTRACT}: Not found"
    continue
  fi
  
  # Extract bytecode
  BYTECODE=$(cat "$JSON_FILE" | jq -r '.bytecode.object')
  
  if [ -z "$BYTECODE" ] || [ "$BYTECODE" = "null" ]; then
    echo "// ⚠️  ${CONTRACT}: No bytecode"
    continue
  fi
  
  echo "// ${CONTRACT}"
  echo "bytecode: \"${BYTECODE}\" as \`0x\${string}\`,"
  echo ""
done

echo ""
echo "✅ Done! Copy the bytecode strings above into the edge function."
