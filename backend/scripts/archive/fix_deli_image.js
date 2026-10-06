const { pool } = require('./db');

async function fixDeliImageUrl() {
    try {
        console.log('Fixing Deli category image URL...');
        
        // Update the image URL to include /uploads/ prefix
        const [result] = await pool.execute(
            `UPDATE categories 
             SET image_url = '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/categories/image-1753860324360-508934332.jpeg'
             WHERE id = 'a52d3611-6578-4868-88fe-f704249603d3' 
               AND tenant_id = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492'
               AND name = 'Deli'`
        );
        
        console.log('Update result:', result);
        
        // Verify the update
        const [categories] = await pool.execute(
            `SELECT id, name, image_url 
             FROM categories 
             WHERE id = 'a52d3611-6578-4868-88fe-f704249603d3'`
        );
        
        console.log('Updated category:', categories[0]);
        
        console.log('✅ Successfully fixed Deli category image URL');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing image URL:', error);
        process.exit(1);
    }
}

fixDeliImageUrl();
