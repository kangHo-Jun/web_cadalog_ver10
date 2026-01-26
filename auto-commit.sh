#!/bin/bash

# Auto-commit script for Cafe24 Web Catalog
# This script monitors file changes and automatically commits them

PROJECT_DIR="/Users/ssup.pi/Public/Antigravity_Project/shopping/cafe24-web-catalog"
cd "$PROJECT_DIR" || exit 1

echo "🔄 Auto-commit enabled for: $PROJECT_DIR"
echo "📝 Monitoring file changes..."

# Function to perform auto-commit
auto_commit() {
    # Check if there are any changes
    if [[ -n $(git status --porcelain) ]]; then
        echo ""
        echo "📦 Changes detected at $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Show what changed
        git status --short
        
        # Add all changes (excluding ignored files)
        git add -A
        
        # Create commit message with timestamp
        COMMIT_MSG="Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Commit
        git commit -m "$COMMIT_MSG"
        
        echo "✅ Auto-committed successfully"
        echo "---"
    fi
}

# Watch for changes every 30 seconds
while true; do
    auto_commit
    sleep 30
done
