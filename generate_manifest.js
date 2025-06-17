const fs = require('fs');
const path = require('path');

// Configuration
const FONT_ASSETS_DIR = 'assets/pairs';
const OUTPUT_FILE = 'assets/manifest.json';

function generateFontManifest() {
    console.log('🔍 Scanning font assets directory...');
    
    try {
        // Check if the directory exists
        if (!fs.existsSync(FONT_ASSETS_DIR)) {
            console.error(`❌ Directory not found: ${FONT_ASSETS_DIR}`);
            console.log('Please ensure your font assets are in the correct directory structure.');
            return;
        }

        // Read all items in the font assets directory
        const items = fs.readdirSync(FONT_ASSETS_DIR);
        
        // Filter for directories only
        const fontPairFolders = items.filter(item => {
            const fullPath = path.join(FONT_ASSETS_DIR, item);
            return fs.statSync(fullPath).isDirectory();
        });

        console.log(`📁 Found ${fontPairFolders.length} font pair folders:`, fontPairFolders);

        // Process each folder to get file listings
        const fontPairs = [];
        
        fontPairFolders.forEach(folder => {
            const folderPath = path.join(FONT_ASSETS_DIR, folder);
            
            try {
                // Read files in this folder
                const files = fs.readdirSync(folderPath);
                
                // Filter for PNG files only
                const pngFiles = files.filter(file => 
                    file.toLowerCase().endsWith('.png')
                );

                if (pngFiles.length > 0) {
                    fontPairs.push({
                        folder: folder,
                        files: pngFiles,
                        fileCount: pngFiles.length
                    });
                    
                    console.log(`  📄 ${folder}: ${pngFiles.join(', ')}`);
                } else {
                    console.warn(`  ⚠️  ${folder}: No PNG files found`);
                }
            } catch (error) {
                console.error(`  ❌ Error reading folder ${folder}:`, error.message);
            }
        });

        // Create the manifest object
        const manifest = {
            generatedAt: new Date().toISOString(),
            totalPairs: fontPairs.length,
            fontPairs: fontPairs
        };

        // Ensure assets directory exists
        const assetsDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
            console.log(`📁 Created assets directory: ${assetsDir}`);
        }

        // Write the manifest file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
        
        console.log(`✅ Manifest generated successfully!`);
        console.log(`📍 Output file: ${OUTPUT_FILE}`);
        console.log(`📊 Total font pairs: ${fontPairs.length}`);
        
        // Show summary
        console.log('\n📋 Summary:');
        fontPairs.forEach(pair => {
            console.log(`  • ${pair.folder}: ${pair.fileCount} files`);
        });

        // Validation warnings
        const pairsWithTwoFiles = fontPairs.filter(pair => pair.fileCount === 2);
        const pairsWithOtherCounts = fontPairs.filter(pair => pair.fileCount !== 2);
        
        if (pairsWithOtherCounts.length > 0) {
            console.log('\n⚠️  Warning: Some folders don\'t have exactly 2 PNG files:');
            pairsWithOtherCounts.forEach(pair => {
                console.log(`  • ${pair.folder}: ${pair.fileCount} files`);
            });
        }

        console.log(`\n🎯 Ready for use: ${pairsWithTwoFiles.length} pairs with exactly 2 files`);

    } catch (error) {
        console.error('❌ Error generating manifest:', error.message);
        console.log('\nPlease check:');
        console.log('1. The font assets directory exists');
        console.log('2. You have read permissions for the directory');
        console.log('3. The directory structure matches the expected format');
    }
}

// Run the manifest generation
if (require.main === module) {
    console.log('🚀 Font Manifest Generator');
    console.log('==========================');
    generateFontManifest();
}

module.exports = { generateFontManifest };