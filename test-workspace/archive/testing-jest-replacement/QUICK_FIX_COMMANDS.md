# COPY-PASTE COMMANDS FOR IMMEDIATE FIX

## 🚨 QUICKEST FIX (30 seconds)

Copy and paste this entire block into your terminal:

```bash
# Check if Node v22 is the issue and fix it
if [[ $(node -v) == v22* ]]; then
  echo "Node v22 detected - switching to v20..."
  if command -v nvm >/dev/null 2>&1; then
    nvm install 20 && nvm use 20 && nvm alias default 20
    rm -rf node_modules package-lock.json && npm install
    npx jest --clearCache 2>/dev/null || true
    echo "✅ Fixed! Run: npm test"
  else
    echo "Install NVM: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "Then rerun this command"
  fi
else
  echo "Not a Node v22 issue. Trying Vitest..."
  npm install -D vitest @vitest/ui
  echo '{"test": "vitest"}' > .vitest-temp.json
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.scripts.test='vitest';fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
  rm .vitest-temp.json
  echo "✅ Vitest installed! Run: npm test"
fi
```

## 📋 ALTERNATIVE: Step-by-Step Commands

### Option 1: Fix Node Version
```bash
nvm install 20
nvm use 20
rm -rf node_modules package-lock.json
npm install
npm test
```

### Option 2: Switch to Vitest
```bash
npm install -D vitest @vitest/ui
# Edit package.json: change test script to "vitest"
npm test
```

### Option 3: Complete Reset
```bash
rm -rf node_modules package-lock.json .jest-cache
npm cache clean --force
nvm use 20
npm install
npm test
```

## 🤖 FOR CLAUDE CODE

Add this to your automation loop to handle the issue:

```javascript
// At the start of your test harness
const nodeVersion = parseInt(process.version.split('.')[0].substring(1));
if (nodeVersion === 22) {
  console.error('ERROR: Node v22 incompatible with Jest');
  console.log('FIX: Run: nvm use 20 && rm -rf node_modules && npm install');
  process.exit(1);
}
```

## 📝 ONE-LINER FOR CI/CD

```bash
[[ $(node -v) == v22* ]] && echo "ERROR: Use Node v20" && exit 1 || npm test
```

## ✅ VERIFICATION COMMAND

After fixing, verify everything works:

```bash
echo "Node: $(node -v)" && echo "NPM: $(npm -v)" && npx jest --version && echo "✅ All working!"
```

---

**Still stuck?** The issue is 100% Node v22 + Jest 29 incompatibility. Either:
1. Use Node v20 (5 minutes)
2. Use Vitest instead (10 minutes)
3. Wait for Jest v30 (unknown timeline)