#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to update version in a file
function updateVersionInFile(filePath, oldVersion, newVersion) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const oldPattern = new RegExp(`v=${oldVersion}`, 'g');
        const newPattern = `v=${newVersion}`;
        
        if (content.includes(`v=${oldVersion}`)) {
            content = content.replace(oldPattern, newPattern);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
        return false;
    }
}

// Function to update version in service worker
function updateServiceWorkerVersion(filePath, oldVersion, newVersion) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const oldPattern = new RegExp(`const VERSION = '${oldVersion}';`, 'g');
        const newPattern = `const VERSION = '${newVersion}';`;
        
        if (content.includes(`const VERSION = '${oldVersion}';`)) {
            content = content.replace(oldPattern, newPattern);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated service worker version in ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error updating service worker ${filePath}:`, error.message);
        return false;
    }
}

// Main function
function updateVersion(newVersion) {
    if (!newVersion) {
        console.log('Usage: node update-version.js <new-version>');
        console.log('Example: node update-version.js 1.0.1');
        process.exit(1);
    }

    console.log(`🔄 Updating version to ${newVersion}...`);

    // Files to update with version parameters
    const filesToUpdate = [
        'index.html',
        'sw.js'
    ];

    // Current version (you can change this as needed)
    const currentVersion = '1.0.10';

    let updatedCount = 0;

    // Update files with version parameters
    filesToUpdate.forEach(file => {
        if (updateVersionInFile(file, currentVersion, newVersion)) {
            updatedCount++;
        }
    });

    // Update service worker version constant
    if (updateServiceWorkerVersion('sw.js', currentVersion, newVersion)) {
        updatedCount++;
    }

    console.log(`\n🎉 Updated ${updatedCount} files to version ${newVersion}`);
    console.log('\n📝 Next steps:');
    console.log('1. Deploy your changes to your server');
    console.log('2. Users will automatically get the update notification');
    console.log('3. The PWA will refresh with the new version');
}

// Run the script
const newVersion = process.argv[2];
updateVersion(newVersion);