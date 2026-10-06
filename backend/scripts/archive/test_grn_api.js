#!/usr/bin/env node

/**
 * Simple GRN API Test Script
 * Tests the GRN API endpoints to debug View GRN modal issue
 */

const http = require('http');

const testGrnApi = async () => {
    console.log('🔍 Testing GRN API endpoints...\n');
    
    const tenantId = 'd7f267da-d5d9-4a15-b0d3-31ca710a4492';
    
    try {
        // Test 1: List all GRNs
        console.log('📋 Test 1: Fetching GRN list...');
        const listResponse = await makeRequest(`/api/grn?tenant_id=${tenantId}`);
        console.log('GRN List Response Status:', listResponse.status);
        
        if (listResponse.status === 200 && listResponse.data) {
            const grns = Array.isArray(listResponse.data) ? listResponse.data : listResponse.data.data || [];
            console.log(`Found ${grns.length} GRNs`);
            
            if (grns.length > 0) {
                const firstGrn = grns[0];
                console.log('First GRN:', {
                    id: firstGrn.id,
                    grnNumber: firstGrn.grnNumber || firstGrn.grn_number,
                    status: firstGrn.status,
                    supplierName: firstGrn.supplierName || firstGrn.supplier_name
                });
                
                // Test 2: Fetch specific GRN details
                console.log('\n📄 Test 2: Fetching GRN details...');
                const detailResponse = await makeRequest(`/api/grn/${firstGrn.id}?tenant_id=${tenantId}`);
                console.log('GRN Detail Response Status:', detailResponse.status);
                
                if (detailResponse.status === 200 && detailResponse.data) {
                    const grnDetail = detailResponse.data;
                    console.log('GRN Detail:', {
                        id: grnDetail.id,
                        grnNumber: grnDetail.grnNumber || grnDetail.grn_number,
                        status: grnDetail.status,
                        itemsCount: grnDetail.items ? grnDetail.items.length : 'No items property',
                        hasItems: !!grnDetail.items
                    });
                    
                    if (grnDetail.items && grnDetail.items.length > 0) {
                        console.log('First item:', {
                            productName: grnDetail.items[0].productName || grnDetail.items[0].product_name,
                            quantity: grnDetail.items[0].quantityReceived || grnDetail.items[0].quantity_received,
                            unitCost: grnDetail.items[0].unitCostPrice || grnDetail.items[0].unit_cost_price
                        });
                    } else {
                        console.log('⚠️  No items found in GRN detail response');
                    }
                } else {
                    console.log('❌ Failed to fetch GRN details:', detailResponse.error);
                }
            } else {
                console.log('⚠️  No GRNs found for tenant');
            }
        } else {
            console.log('❌ Failed to fetch GRN list:', listResponse.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

// Helper function to make HTTP requests
const makeRequest = (path) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImExYjJjM2Q0LWU1ZjYtNGE1Yi04YzdkLTllMGYxYTJiM2M0ZCIsImVtYWlsIjoiYWRtaW5AemV0dGF6LmNvbSIsIm5hbWUiOiJOYXJlc2ggVmVsdXNhbXkiLCJ0ZW5hbnRfaWQiOiJkN2YyNjdkYS1kNWQ5LTRhMTUtYjBkMy0zMWNhNzEwYTQ0OTIiLCJzdG9yZV9pZCI6ImRlZmF1bHQtZDdmMjY3ZGEtZDVkOS00YTE1LWIwZDMtMzFjYTcxMGE0NDkyIiwiaWF0IjoxNzMzNDU0NzU4LCJleHAiOjE3MzM0NTgzNTh9.example',
                'x-tenant-id': 'd7f267da-d5d9-4a15-b0d3-31ca710a4492',
                'x-store-id': 'default-d7f267da-d5d9-4a15-b0d3-31ca710a4492'
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: jsonData
                    });
                } catch (err) {
                    resolve({
                        status: res.statusCode,
                        error: 'Invalid JSON response',
                        rawData: data
                    });
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        req.end();
    });
};

// Execute test
if (require.main === module) {
    testGrnApi()
        .then(() => {
            console.log('\n✅ GRN API test completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ GRN API test failed:', error);
            process.exit(1);
        });
}

module.exports = { testGrnApi };
