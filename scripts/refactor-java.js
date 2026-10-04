const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'restaurant', 'orders');
const destDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'dreamdesserts', 'app');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.readdirSync(srcDir).forEach(file => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    let content = fs.readFileSync(srcFile, 'utf8');
    content = content.replace(/package com\.restaurant\.orders;/g, 'package com.dreamdesserts.app;');
    content = content.replace(/com\.restaurant\.orders/g, 'com.dreamdesserts.app');
    fs.writeFileSync(destFile, content, 'utf8');
  });
  fs.rmSync(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'restaurant'), { recursive: true, force: true });
  console.log('✅ Java package successfully refactored to com.dreamdesserts.app');
}
