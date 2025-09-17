#!/bin/bash
# Cleanup script after git history rewrite

echo "Git Repository Cleanup After History Rewrite"
echo "============================================"
echo ""

# Remove original refs from filter-branch
echo "Removing original refs..."
rm -rf .git/refs/original/

# Expire reflog entries
echo "Expiring reflog entries..."
git reflog expire --expire=now --all

# Garbage collect and prune
echo "Running aggressive garbage collection..."
git gc --prune=now --aggressive

# Reapply stashed changes
echo ""
echo "Reapplying stashed changes..."
git stash pop

echo ""
echo "Cleanup complete!"
echo ""
echo "Current repository status:"
git status --short
echo ""
echo "All commits are now attributed to sirfifer:"
git log --format="%an <%ae>" main | sort | uniq -c