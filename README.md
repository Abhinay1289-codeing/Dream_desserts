# Digital Menu & Ordering System — Dream Desserts

> ⚠️ **AI AGENT & DEVELOPER INSTRUCTIONS**: Refer to [PROJECT_INSTRUCTIONS.md](file:///d:/reastarent_saas/PROJECT_INSTRUCTIONS.md) for local APK build rules, App ID (`com.dreamdesserts.app`), and token architecture requirements.

## 🚀 Netlify Deployment Instructions

### Step 1: Prepare your repo
- Make sure you don't commit `.env`, `index.html`, `admin.html`, `admin-orders.html`, or `table.html` (they're in `.gitignore`)
- Commit:
  - `*.template.html` files
  - All other files except the ones listed in `.gitignore`

### Step 2: Deploy to Netlify
1. Go to https://app.netlify.com
2. Drag & drop your entire folder OR connect your git repo
3. **Add Environment Variables in Netlify**:
   - Go to Site settings → Environment variables
   - Add:
     - `SUPABASE_URL` = your Supabase project URL
     - `SUPABASE_KEY` = your Supabase anon key

### Step 3: Update Netlify to inject env vars into HTML
For Netlify, we need to use a build plugin or a simple build script to replace placeholders! Let's update our `netlify.toml` and add a build script:

First, update `package.json` build script (we'll create it next):
```json
{
  "scripts": {
    "build": "node scripts/netlify-build.js"
  }
}
```

Now create `netlify-build.js` in the scripts folder:
```javascript
// Netlify build script to inject environment variables
const fs = require('fs');
const path = require('path');

const templateMap = {
  'index.html': 'index.template.html',
  'admin.html': 'admin.template.html',
  'admin-orders.html': 'admin-orders.template.html',
  'table.html': 'table.template.html'
};

Object.entries(templateMap).forEach(([targetFile, templateFile]) => {
  const templatePath = path.join(__dirname, '..', templateFile);
  const targetPath = path.join(__dirname, '..', targetFile);
  
  if (fs.existsSync(templatePath)) {
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders with Netlify env vars
    html = html.replace('YOUR_SUPABASE_URL', process.env.SUPABASE_URL);
    html = html.replace('YOUR_SUPABASE_ANON_KEY', process.env.SUPABASE_KEY);
    
    fs.writeFileSync(targetPath, html, 'utf8');
    console.log(`✅ Injected env vars into ${targetFile}`);
  }
});
```

Now update `netlify.toml` to use this build script:
```toml
[build]
  publish = "."
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 🔒 Security Checklist
- ✅ .env in .gitignore
- ✅ HTML files with injected env vars in .gitignore
- ✅ Supabase Anon Key is public (protected by RLS!)
- ✅ Supabase Service Role Key is never exposed!

## 📝 Supabase Setup Reminder
- Enable RLS on all tables!
- Set proper RLS policies to restrict writes!
- Never use the service_role key in frontend code!

