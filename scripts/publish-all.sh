#!/bin/bash
# Publish all @xclaw-ai packages to npm in dependency order
# Usage: ./scripts/publish-all.sh <OTP_CODE>

set -e

OTP="${1:?Usage: $0 <OTP_CODE>}"

PACKAGES=(
  "packages/shared"
  "packages/db"
  "packages/core"
  "packages/integrations"
  "packages/domains"
  "packages/ml"
  "packages/skills"
  "packages/skill-hub"
  "packages/gateway"
  "packages/channels/telegram"
  "packages/channels/discord"
  "packages/cli"
  "packages/chat-sdk"
)

echo "🚀 Publishing all @xclaw-ai packages to npm..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  NAME=$(node -p "require('./$pkg/package.json').name")
  VERSION=$(node -p "require('./$pkg/package.json').version")
  PRIVATE=$(node -p "require('./$pkg/package.json').private || false")

  if [[ "$PRIVATE" == "true" ]]; then
    echo "⏭️  $NAME@$VERSION (private, skipping)"
    continue
  fi

  # Check if version already exists
  if npm view "${NAME}@${VERSION}" --registry https://registry.npmjs.org >/dev/null 2>&1; then
    echo "⚠️  $NAME@$VERSION already exists, skipping"
  else
    echo "📦 Publishing $NAME@$VERSION..."
    npm publish --workspace "$pkg" --access public --otp="$OTP" 2>&1 | tail -1
    echo "✅ $NAME@$VERSION published"
  fi
done

echo ""
echo "🎉 All packages published!"
