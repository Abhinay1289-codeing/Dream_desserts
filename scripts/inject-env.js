// Script to inject environment variables into HTML files for local development using templates
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Map original HTML files to their templates
const templateMap = {
  'index.html': 'index.template.html',
  'table.html': 'table.template.html',
  'admin.html': 'admin.template.html',
  'admin-orders.html': 'admin-orders.template.html',
  'qr-setup.html': 'qr-setup.template.html'
};

// First, make sure we have templates for all files
Object.values(templateMap).forEach(templateFile => {
  const templatePath = path.join(__dirname, '..', templateFile);
  if (!fs.existsSync(templatePath)) {
    // If template doesn't exist, create it from the current file
    const originalFile = Object.keys(templateMap).find(key => templateMap[key] === templateFile);
    const originalPath = path.join(__dirname, '..', originalFile);
    if (fs.existsSync(originalPath)) {
      let content = fs.readFileSync(originalPath, 'utf8');
      // Replace any existing env vars with placeholders
      content = content.replace(
        /SUPABASE_URL:\s*['"][^'"]*['"]/g,
        "SUPABASE_URL: 'YOUR_SUPABASE_URL'"
      );
      content = content.replace(
        /SUPABASE_KEY:\s*['"][^'"]*['"]/g,
        "SUPABASE_KEY: 'YOUR_SUPABASE_ANON_KEY'"
      );
      content = content.replace(
        /GOOGLE_MAPS_API_KEY:\s*['"][^'"]*['"]/g,
        "GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY'"
      );
      fs.writeFileSync(templatePath, content, 'utf8');
      console.log(`✅ Created template ${templateFile} from ${originalFile}`);
    }
  }
});

// Now inject env vars into the actual HTML files from templates (both in root and app/ for Capacitor)
Object.entries(templateMap).forEach(([targetFile, templateFile]) => {
  const templatePath = path.join(__dirname, '..', templateFile);
  const targetPaths = [
    path.join(__dirname, '..', targetFile),
    path.join(__dirname, '..', 'app', targetFile)
  ];
  
  if (fs.existsSync(templatePath)) {
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Only replace if we have real values, otherwise keep placeholders
    const useUrl = (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('YOUR') && !process.env.SUPABASE_URL.includes('your-project')) 
      ? process.env.SUPABASE_URL 
      : 'YOUR_SUPABASE_URL';
    
    const useKey = (process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.includes('YOUR') && !process.env.SUPABASE_KEY.includes('your-anon')) 
      ? process.env.SUPABASE_KEY 
      : 'YOUR_SUPABASE_ANON_KEY';
      
    const useMapsKey = (process.env.GOOGLE_MAPS_API_KEY && !process.env.GOOGLE_MAPS_API_KEY.includes('YOUR'))
      ? process.env.GOOGLE_MAPS_API_KEY
      : 'YOUR_GOOGLE_MAPS_API_KEY';
    
    html = html.replace('YOUR_SUPABASE_URL', useUrl);
    html = html.replace('YOUR_SUPABASE_ANON_KEY', useKey);
    html = html.replace('YOUR_GOOGLE_MAPS_API_KEY', useMapsKey);
    
    targetPaths.forEach(targetPath => {
      const dir = path.dirname(targetPath);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(targetPath, html, 'utf8');
        console.log(`✅ Injected env vars into ${path.relative(path.join(__dirname, '..'), targetPath)}`);
      }
    });
  }
});
