const { pool } = require('./db');

async function fixDairyEggsImageUrl() {
    try {
        console.log('Fixing Dairy & Eggs category image URL...');
        
        // Update the image URL to include /uploads/ prefix
        const [result] = await pool.execute(
            `UPDATE categories 
             SET image_url = '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/categories/image-1753859300431-386646008.jpeg'
             WHERE id = 'f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8' 
               AND tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
               AND name = 'Dairy & Eggs'`
        );
        
        console.log('Update result:', result);
        
        // Verify the update
        const [categories] = await pool.execute(
            `SELECT id, name, image_url 
             FROM categories 
             WHERE id = 'f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8'`
        );
        
        console.log('Updated category:', categories[0]);
        
        console.log('✅ Successfully fixed Dairy & Eggs category image URL');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing image URL:', error);
        process.exit(1);
    }
}

fixDairyEggsImageUrl();
